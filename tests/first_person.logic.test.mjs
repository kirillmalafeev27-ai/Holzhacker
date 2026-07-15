import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import * as THREE from "three";
import { ASSET_URLS, CONFIG, assetUrlsForProfile, runtimeConfig } from "../public/js/fps/config.js";
import { ChoppingSystem } from "../public/js/fps/chopping.js";
import { NoteSystem } from "../public/js/fps/notes.js";
import { FortSystem } from "../public/js/fps/fort.js";
import { NavigationSystem } from "../public/js/fps/navigation.js";
import { ProjectileSystem } from "../public/js/fps/projectiles.js";
import { FirstPersonRig, sweepAabb, sweepCircle } from "../public/js/fps/player.js";
import { isEditableTarget } from "../public/js/fps/input.js";
import { CatapultSystem } from "../public/js/fps/enemies.js";
import { AssetStore } from "../public/js/fps/assets.js";
import { adjustedCatapultPosition, blocksTowerShot, catapultPatrolEndpoints, catapultPositionPool, relocateOffTowerShots } from "../public/js/fps/world-layout.js";
import { PerformanceDetector, detectHardwareProfile, shouldKeepDecoration } from "../public/js/fps/performance.js";

const require = createRequire(import.meta.url);
const { localEvaluation } = require("../recall-evaluation.cjs");
const { __test: quizGenerationTest } = require("../see-escape-claude-practical-gates-bDFmc/quiz-generation.cjs");


const passed = [];
const pass = (name) => passed.push(name);
const silentAudio = { play() {} };
const silentEffects = {
  woodBurst() {}, groundImpact() {}, constructionBurst() {}, repairBurst() {},
  catapultImpact() {}, smoke() {},
};


// A — deployment/dev flags never speed up the production simulation.
globalThis.location = { search: "?demo=1&preset=tree&navdebug=1" };
const runtime = runtimeConfig();
assert.equal(runtime.dev, true);
assert.equal(runtime.demo, true);
assert.equal(runtime.preset, "tree");
assert.equal(runtime.timeScale, 1);
pass("A runtime modes");


// B — the first correct learning answer grants exactly two manual axe hits;
// the second grants every remaining hit required to fell the tree.
const chopScene = new THREE.Group();
const chopAssets = {
  markerPosition(name) {
    const index = Number(name.slice(-2));
    return index >= 1 && index <= CONFIG.CHOP.TREE_COUNT ? new THREE.Vector3(index * 2, 0, 0) : null;
  },
  clone(key) {
    const group = new THREE.Group();
    if (key === "treeFallen") {
      const stump = new THREE.Group(); stump.name = "TreeStump";
      const crown = new THREE.Group(); crown.name = "TreeCrownFallen";
      group.add(stump, crown);
    }
    return group;
  },
};
const chopPlayer = {
  carrying: false,
  position: new THREE.Vector3(-2, CONFIG.PLAYER.EYE_HEIGHT, 0),
  rig: { startSwing(onImpact) { onImpact(); return true; } },
  setCarrying(value) { this.carrying = value; },
};
const chopping = new ChoppingSystem(chopScene, chopAssets, chopPlayer, silentEffects, silentAudio);
assert.equal(chopping.trees.length, 12);
const tree = chopping.trees[0];
assert.equal(chopping.chop(tree), false);
assert.equal(tree.hits, 0);
assert.equal(chopping.nextQuizHitGrant(tree), 2);
assert.equal(chopping.grantQuizHits(tree), 2);
assert.equal(tree.hitCredits, 2);
assert.equal(chopping.chop(tree), true);
assert.equal(tree.hits, 1);
assert.equal(tree.hitCredits, 1);
assert.equal(chopping.chop(tree), true);
assert.equal(tree.hits, 2);
assert.equal(tree.hitCredits, 0);
assert.equal(chopping.chop(tree), false);
assert.equal(chopping.nextQuizHitGrant(tree), 2);
assert.equal(chopping.grantQuizHits(tree), 2);
assert.equal(tree.hitCredits, 2);
assert.equal(chopping.chop(tree), true);
assert.equal(tree.hits, 3);
assert.equal(chopping.chop(tree), true);
assert.equal(tree.hits, 4);
assert.equal(tree.state, "falling");
assert.equal(tree.models[4].visible, false);
assert.equal(tree.models[5].visible, true);
const toPlayer = chopPlayer.position.clone().sub(tree.root.position).setY(0).normalize();
chopping.update(CONFIG.CHOP.FALL_DURATION + .1);
assert.equal(tree.state, "fallen");
assert.equal(tree.models[5].visible, true);
const fallDirection = chopping.fallDirection(tree);
assert.ok(fallDirection.dot(toPlayer) < -.99);
assert.ok(tree.fallenCrown.position.distanceTo(new THREE.Vector3(1.0503, 1.4332, 0)) < .002);
assert.ok(Math.abs(tree.fallenCrown.rotation.z - THREE.MathUtils.degToRad(87)) < 1e-6);
assert.equal(chopping.logs.length, 0);
chopping.update(CONFIG.CHOP.TRUNK_LINGER_SECONDS + .1);
assert.equal(tree.state, "cleared");
assert.equal(chopping.logs.length, 1);
const logOffset = chopping.logs[0].object.position.clone().sub(tree.root.position).setY(0).normalize();
assert.ok(logOffset.dot(fallDirection) > .99);
assert.equal(chopping.logs[0].object.scale.x, CONFIG.CHOP.LOG_LENGTH);
assert.equal(chopping.logs[0].object.scale.y, CONFIG.CHOP.LOG_THICKNESS);
assert.equal(CONFIG.CHOP.LOG_LENGTH / 2, CONFIG.CHOP.LOG_DISTANCE);
assert.equal(chopping.pickup(chopping.logs[0]), true);
assert.equal(chopPlayer.carrying, true);
pass("B chopping and fall");


// C — notes are collectable from eye height using horizontal proximity.
const noteScene = new THREE.Group();
const notes = new NoteSystem(
  noteScene,
  { clone() { return new THREE.Group(); } },
  { nearestPoint(position) { return position.clone(); } },
  silentAudio,
);
let collected = 0;
notes.onCollected = (count) => { collected = count; };
notes.drop(new THREE.Vector3(0, 0, 0), 2);
notes.update(.1, new THREE.Vector3(0, CONFIG.PLAYER.EYE_HEIGHT, 0));
assert.equal(notes.collected, 1);
notes.update(.1, new THREE.Vector3(0, CONFIG.PLAYER.EYE_HEIGHT, 0));
assert.equal(notes.collected, 2);
assert.equal(collected, 2);
pass("C note pickup");


// D — construction changes navmesh on every stage and leaves the final gate usable.
function fortAsset(key) {
  const group = new THREE.Group();
  if (key === "fort3") {
    const left = new THREE.Group(); left.name = "GateLeftPivot";
    const right = new THREE.Group(); right.name = "GateRightPivot";
    const wall = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0x83512e }));
    wall.name = "PalisadePost_001";
    const railPost = new THREE.Group(); railPost.name = "TowerRailPost_0_1_0"; railPost.position.y = 6.72;
    const rail = new THREE.Group(); rail.name = "TowerRail_0_1"; rail.position.y = 7.2;
    const roof = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0x153452 }));
    roof.name = "TowerRoof"; roof.position.y = 8.35;
    const workshopLeft = new THREE.Mesh(new THREE.BoxGeometry(2.8, .2, 3.8), new THREE.MeshStandardMaterial({ color: 0x427c9e }));
    workshopLeft.name = "WorkshopRoofLeft"; workshopLeft.position.set(-5.55, 2.65, -1.2);
    const workshopRight = workshopLeft.clone(); workshopRight.name = "WorkshopRoofRight"; workshopRight.position.x = -3.25;
    const storehouse = new THREE.Mesh(new THREE.BoxGeometry(3.3, 2.4, 2.9), new THREE.MeshStandardMaterial({ color: 0xa26f42 }));
    storehouse.name = "StorehouseBody"; storehouse.position.set(3.8, 1.2, 2);
    group.add(left, right, wall, railPost, rail, roof, workshopLeft, workshopRight, storehouse);
  }
  return group;
}
const navSwitches = [];
const fortNavigation = {
  switchState(stage, open) { navSwitches.push([stage, open]); },
  setWallDamageRatio() {},
  attackPoints: [],
};
const fort = new FortSystem(new THREE.Group(), { clone: fortAsset }, fortNavigation, silentEffects);
const shortenedPost = fort.groups[3].getObjectByName("TowerRailPost_0_1_0");
const loweredRail = fort.groups[3].getObjectByName("TowerRail_0_1");
assert.ok(Math.abs(shortenedPost.scale.y - CONFIG.TOWER.RAIL_HEIGHT / 1.2) < 1e-9);
assert.ok(Math.abs(loweredRail.position.y - (CONFIG.TOWER.PLATFORM_TOP + CONFIG.TOWER.RAIL_HEIGHT)) < 1e-9);
const raisedRoof = fort.groups[3].getObjectByName("TowerRoof");
assert.ok(Math.abs(raisedRoof.position.y - (8.35 + CONFIG.TOWER.ROOF_RAISE)) < 1e-9);
assert.equal(raisedRoof.scale.x, CONFIG.TOWER.ROOF_SCALE_XZ);
assert.equal(raisedRoof.material.side, THREE.DoubleSide);
const workshopRoof = fort.groups[3].getObjectByName("WorkshopRoofLeft");
assert.equal(workshopRoof.scale.z, CONFIG.FORT_BUILDINGS.ROOF_SCALE_Z);
assert.equal(workshopRoof.material.color.getHex(), CONFIG.FORT_BUILDINGS.ROOF_COLOR);
assert.ok(fort.groups[3].getObjectByName("WorkshopRoofRidge"));
for (let stage = 1; stage <= 3; stage += 1) {
  assert.equal(fort.buildNext(), true);
  fort.update(2);
}
assert.equal(fort.stage, 3);
assert.equal(fort.gateState, "open");
assert.equal(fort.gateOpen, true);
assert.deepEqual(navSwitches.slice(0, 3).map(([stage]) => stage), [1, 2, 3]);
assert.deepEqual(navSwitches.at(-1), [3, true]);
fort.damage(500);
assert.equal(fort.health, 500);
assert.equal(fort.repair(), 500);
assert.equal(fort.health, CONFIG.BUILD.MAX_HEALTH);
pass("D fort and gate navigation");


// D2 — the authored section of stage-1 palisade is solid from both sides.
const stageOneFort = new FortSystem(new THREE.Group(), { clone: fortAsset }, fortNavigation, silentEffects);
stageOneFort.buildNext();
const wallRadius = (CONFIG.BUILD.WALL_INNER_RADIUS + CONFIG.BUILD.WALL_OUTER_RADIUS) / 2;
const builtAngle = .35;
const radialPrevious = new THREE.Vector3(Math.cos(builtAngle) * 9, 0, -Math.sin(builtAngle) * 9);
const radialNext = new THREE.Vector3(Math.cos(builtAngle) * 9.7, 0, -Math.sin(builtAngle) * 9.7);
stageOneFort.resolvePlayerCollision(radialNext, radialPrevious);
assert.ok(radialNext.distanceTo(radialPrevious) < 1e-9);
const gapAngle = 3;
const tangentialPrevious = new THREE.Vector3(Math.cos(gapAngle) * wallRadius, 0, -Math.sin(gapAngle) * wallRadius);
const tangentialNext = new THREE.Vector3(Math.cos(builtAngle) * wallRadius, 0, -Math.sin(builtAngle) * wallRadius);
stageOneFort.resolvePlayerCollision(tangentialNext, tangentialPrevious);
assert.ok(tangentialNext.distanceTo(tangentialPrevious) < 1e-9);
const gapPrevious = new THREE.Vector3(Math.cos(gapAngle) * 9, 0, -Math.sin(gapAngle) * 9);
const gapNext = new THREE.Vector3(Math.cos(gapAngle) * 9.7, 0, -Math.sin(gapAngle) * 9.7);
stageOneFort.resolvePlayerCollision(gapNext, gapPrevious);
assert.ok(gapNext.distanceTo(gapPrevious) > .5);
pass("D2 stage-1 wall collision");


// D3 — solid base props use their real footprint after the final stage.
while (stageOneFort.stage < 3) stageOneFort.buildNext();
const throughStorehouseStart = new THREE.Vector3(0, 0, 2);
const throughStorehouseEnd = new THREE.Vector3(7, 0, 2);
stageOneFort.resolvePlayerCollision(throughStorehouseEnd, throughStorehouseStart);
assert.ok(throughStorehouseEnd.x < 2);
assert.ok(stageOneFort.interiorColliders.some((collider) => collider.name === "StorehouseBody"));
pass("D3 solid fort interior");


// E — the installed three-pathfinding package builds and queries a real zone.
const plane = new THREE.PlaneGeometry(32, 32, 16, 16).rotateX(-Math.PI / 2);
const navigation = new NavigationSystem(
  new THREE.Group(),
  { navGeometry() { return plane.clone(); } },
);
const start = new THREE.Vector3(-8, 0, -8);
const target = new THREE.Vector3(8, 0, 8);
assert.notEqual(navigation.groupFor(start), null);
const path = navigation.findPath(start, target);
assert.ok(path.length > 0);
assert.ok(navigation.nearestPoint(start).isVector3);
navigation.switchState(3, false);
assert.equal(navigation.currentKey, "nav3Closed");
pass("E three-pathfinding zone");


// F — pooled projectiles follow gravity and invoke exactly one impact.
const projectileScene = new THREE.Group();
const projectiles = new ProjectileSystem(
  projectileScene,
  { clone() { return new THREE.Group(); } },
  silentEffects,
  silentAudio,
);
let impacts = 0;
const projectile = projectiles.launch({
  kind: "test",
  start: new THREE.Vector3(0, 2, 0),
  target: new THREE.Vector3(10, 0, 0),
  flightTime: 1.5,
  onImpact() { impacts += 1; },
});
assert.ok(projectile);
let peak = projectile.object.position.y;
for (let step = 0; step < 100; step += 1) {
  projectiles.update(.02);
  peak = Math.max(peak, projectile.object.position.y);
}
assert.ok(peak > 2);
assert.equal(impacts, 1);
assert.equal(projectiles.active.length, 0);
pass("F ballistic projectile");


// G — sprint/dodge movement cannot tunnel through a tree collider.
const moveStart = new THREE.Vector3(-3, 0, 0);
const moveEnd = new THREE.Vector3(3, 0, 0);
assert.equal(sweepCircle(moveStart, moveEnd, new THREE.Vector3(0, 0, 0), 1.2, moveEnd), true);
assert.ok(moveEnd.x < -1.19);
const boxEnd = new THREE.Vector3(4, 0, 0);
assert.equal(sweepAabb(new THREE.Vector3(-4, 0, 0), boxEnd, new THREE.Vector3(0, 0, 0), 1.5, 1, boxEnd), true);
assert.ok(boxEnd.x < -1.49);
pass("G swept tree collision");


// H — collisionRadius values are already world-space metres and are not
// multiplied by the large visual scale of imported forest assets.
const collisionWorld = new THREE.Group();
const scaledTree = new THREE.Group();
scaledTree.name = "ForestTree_999";
scaledTree.position.set(12, 0, 4);
scaledTree.scale.setScalar(9.2);
scaledTree.userData.collisionRadius = .9;
scaledTree.userData.kind = "forestTree";
collisionWorld.add(scaledTree);
const collisionStore = new AssetStore();
collisionStore.assets.set("world", collisionWorld);
const authoredColliders = collisionStore.worldCollisionData();
assert.equal(authoredColliders.length, 1);
assert.equal(authoredColliders[0].radius, .9);
pass("H authored collider radius");


// I — with authored radii, the actual map remains connected from the spawn to
// every outer sector beyond the old 46 m circular restriction.
function readGlbJson(path) {
  const buffer = fs.readFileSync(path);
  const jsonLength = buffer.readUInt32LE(12);
  return JSON.parse(buffer.subarray(20, 20 + jsonLength).toString().replace(/\0+$/, ""));
}
const worldJson = readGlbJson(new URL("../public/assets/forest_defense/first_person/first_person_world_1k_meshopt.glb", import.meta.url));
const nodeByName = (name) => worldJson.nodes.find((node) => node.name === name);
const nodePosition = (name) => {
  const translation = nodeByName(name)?.translation;
  return translation ? new THREE.Vector3(...translation) : null;
};
const towerShotOrigin = nodePosition("Watchtower");
const initialCatapultShotTargets = ["CatapultSpawn_A", "CatapultSpawn_B", "CatapultSpawn_C"]
  .map(nodePosition)
  .filter(Boolean)
  .map((position) => adjustedCatapultPosition(position));
const catapultShotTargets = catapultPositionPool(initialCatapultShotTargets);
assert.equal(catapultShotTargets.length, CONFIG.CATAPULTS.COUNT * 3);
const worldTrees = worldJson.nodes
  .filter((node) => /^ForestTree_\d+$/.test(node.name) && node.translation)
  .map((node) => new THREE.Vector3(...node.translation));
const corridorBlockers = worldTrees.filter((position) => blocksTowerShot(position, towerShotOrigin, catapultShotTargets));
assert.ok(corridorBlockers.length > 0);
const relocatedBlockers = corridorBlockers.map((position) => relocateOffTowerShots(position, towerShotOrigin, catapultShotTargets));
assert.equal(relocatedBlockers.filter((position) => blocksTowerShot(position, towerShotOrigin, catapultShotTargets)).length, 0);
assert.ok(corridorBlockers.length < worldTrees.length * .3);
pass("I clear tower shot corridors");

const mapColliders = worldJson.nodes
  .filter((node) => node.extras?.collisionRadius && node.translation)
  .map((node) => ({ x: node.translation[0], z: node.translation[2], radius: Number(node.extras.collisionRadius) + CONFIG.PLAYER.RADIUS }));
const step = .75;
const min = -CONFIG.WORLD.HALF_SIZE;
const count = Math.floor(CONFIG.WORLD.HALF_SIZE * 2 / step) + 1;
const key = (x, z) => z * count + x;
const blocked = (x, z) => {
  const blenderY = -z;
  const streamCenter = -28.2 + Math.sin(blenderY * .085) * 2.3 + blenderY * .035;
  const onBridge = Math.abs(z - CONFIG.WORLD.BRIDGE_Z) < 2.25;
  if (!onBridge && Math.abs(x - streamCenter) < CONFIG.WORLD.STREAM_BLOCK_HALF_WIDTH + CONFIG.PLAYER.RADIUS) return true;
  return mapColliders.some((collider) => Math.hypot(x - collider.x, z - collider.z) < collider.radius);
};
const startX = Math.round((0 - min) / step);
const startZ = Math.round((15 - min) / step);
const queue = [[startX, startZ]];
const visited = new Set([key(startX, startZ)]);
for (let cursor = 0; cursor < queue.length; cursor += 1) {
  const [gx, gz] = queue[cursor];
  for (const [dx, dz] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]) {
    const nx = gx + dx, nz = gz + dz;
    if (nx < 0 || nz < 0 || nx >= count || nz >= count || visited.has(key(nx, nz))) continue;
    const x = min + nx * step, z = min + nz * step;
    if (blocked(x, z)) continue;
    visited.add(key(nx, nz));
    queue.push([nx, nz]);
  }
}
const outerSectors = new Set();
for (const [gx, gz] of queue) {
  const x = min + gx * step, z = min + gz * step;
  if (Math.hypot(x, z) <= 46.5) continue;
  const angle = (Math.atan2(z, x) + Math.PI * 2) % (Math.PI * 2);
  outerSectors.add(Math.floor(angle / (Math.PI / 4)) % 8);
}
assert.equal(outerSectors.size, 8);
pass("J full-map reachability");


// K — catapults patrol a short line and their live position is the collider.
const catapultAssets = {
  markerPosition(name) {
    const index = "ABC".indexOf(name.at(-1));
    return new THREE.Vector3(24 + index * 3, 0, -10 + index * 10);
  },
  clone() { return new THREE.Group(); },
};
let catapultNotesDropped = 0;
const catapultSystem = new CatapultSystem(
  new THREE.Group(), catapultAssets,
  { launch() {} }, { health: 1000 },
  { position: new THREE.Vector3(), velocity: new THREE.Vector3(), damage() {} },
  { drop(_position, count) { catapultNotesDropped += count; } }, silentEffects, silentAudio,
);
const movingCatapult = catapultSystem.catapults[0];
const anchor = movingCatapult.anchor.clone();
const catapultCollider = catapultSystem.collisionData()[0];
assert.equal(catapultCollider.position, movingCatapult.position);
assert.equal(catapultCollider.radius, CONFIG.CATAPULTS.COLLISION_RADIUS);
catapultSystem.activate();
catapultSystem.update(1);
assert.ok(movingCatapult.position.distanceTo(anchor) > .2);
assert.ok(movingCatapult.position.distanceTo(anchor) <= CONFIG.CATAPULTS.PATROL_DISTANCE);
assert.ok(movingCatapult.intact.position.distanceTo(movingCatapult.position) < 1e-9);
const patrol = catapultPatrolEndpoints(anchor);
assert.ok(Math.abs(patrol.back.distanceTo(patrol.front) - CONFIG.CATAPULTS.PATROL_DISTANCE * 2) < 1e-9);
assert.equal(CONFIG.CATAPULTS.HITS_TO_DESTROY, 1);
const originalAnchors = catapultSystem.catapults.map((catapult) => catapult.anchor.clone());
for (const catapult of catapultSystem.catapults) {
  assert.equal(catapultSystem.hit(catapult.id), true);
  assert.equal(catapult.destroyedState, true);
}
assert.equal(catapultNotesDropped, 3);
catapultSystem.update(CONFIG.CATAPULTS.REINFORCEMENT_DELAY + CONFIG.CATAPULTS.REINFORCEMENT_STAGGER * 2 + .1);
const reinforcedAnchors = catapultSystem.catapults.map((catapult) => catapult.anchor.clone());
for (const reinforced of reinforcedAnchors) {
  assert.ok(originalAnchors.every((original) => reinforced.distanceTo(original) > 1));
}
for (let left = 0; left < reinforcedAnchors.length; left += 1) {
  for (let right = left + 1; right < reinforcedAnchors.length; right += 1) {
    assert.ok(reinforcedAnchors[left].distanceTo(reinforcedAnchors[right]) > 5);
  }
}
catapultSystem.update(CONFIG.CATAPULTS.REINFORCEMENT_ARRIVAL_DURATION + .1);
for (const catapult of catapultSystem.catapults) {
  assert.equal(catapult.state, "idle");
  assert.equal(catapultSystem.hit(catapult.id), true);
}
assert.equal(catapultNotesDropped, CONFIG.NOTES.TOTAL);
catapultSystem.update(CONFIG.CATAPULTS.REINFORCEMENT_DELAY + CONFIG.CATAPULTS.REINFORCEMENT_STAGGER * 2 + .1);
catapultSystem.update(CONFIG.CATAPULTS.REINFORCEMENT_ARRIVAL_DURATION + .1);
assert.equal(catapultSystem.hit(0), true);
assert.equal(catapultNotesDropped, CONFIG.NOTES.TOTAL);
pass("K moving solid catapults");


// L — the three authored first-person pose assets switch cleanly and the
// common pose root drives the axe swing without corrupting their transforms.
const rigCamera = new THREE.PerspectiveCamera(68, 16 / 9, .06, 130);
const rig = new FirstPersonRig(rigCamera, {
  clone(key) {
    const group = new THREE.Group();
    group.userData.assetKey = key;
    group.add(new THREE.Mesh(new THREE.BoxGeometry(.1, .1, .1), new THREE.MeshBasicMaterial()));
    return group;
  },
});
const rigMeshes = [];
rig.root.traverse((object) => {
  assert.equal(object.layers.mask, 2);
  if (object.isMesh) rigMeshes.push(object);
});
assert.equal(rigMeshes.length, 3);
assert.ok(rigMeshes.every((mesh) => {
  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  return materials.every((material) => material.depthTest && material.depthWrite);
}));
assert.equal(rig.views.axe.visible, true);
assert.equal(rig.setMode("stone"), true);
assert.equal(rig.views.axe.visible, false);
assert.equal(rig.views.stone.visible, true);
assert.equal(rig.setMode("log"), true);
assert.equal(rig.views.log.visible, true);
rig.setMode("axe");
let rigImpact = 0;
assert.equal(rig.startSwing(() => { rigImpact += 1; }), true);
rig.update(CONFIG.CHOP.IMPACT_TIME + .01, false, false);
assert.equal(rigImpact, 1);
assert.notEqual(rig.poseRoot.rotation.x, 0);
rig.update(CONFIG.CHOP.SWING_DURATION, false, false);
assert.equal(rig.swing, null);
assert.equal(rig.poseRoot.rotation.x, 0);
pass("L authored viewmodel modes");


// M — recall fallback accepts harmless typography differences and explains
// a genuinely different answer immediately when AI is not configured.
assert.equal(localEvaluation("  Der Baum. ", "der Baum").correct, true);
const recallWrong = localEvaluation("die Bäume", "der Baum");
assert.equal(recallWrong.correct, false);
assert.match(recallWrong.explanation, /der Baum/);
pass("M recall answer fallback");


// N — movement keys remain ordinary text while an editable control has focus.
assert.equal(isEditableTarget({ tagName: "INPUT", isContentEditable: false }), true);
assert.equal(isEditableTarget({ tagName: "TEXTAREA", isContentEditable: false }), true);
assert.equal(isEditableTarget({ tagName: "CANVAS", isContentEditable: false }), false);
pass("N typing ignores movement bindings");


// O — both test modes return wrong answers to the active pool, and the bank
// exposes the paired accept path so a later correct retry can be retired.
const recognitionSource = fs.readFileSync(new URL("../see-escape-claude-practical-gates-bDFmc/public/js/action-quiz.js", import.meta.url), "utf8");
const recallSource = fs.readFileSync(new URL("../public/js/fps/learning-system.js", import.meta.url), "utf8");
const bankSource = fs.readFileSync(new URL("../see-escape-claude-practical-gates-bDFmc/public/js/learning.js", import.meta.url), "utf8");
assert.match(recognitionSource, /releaseQuizQuestion/);
assert.match(recallSource, /releaseQuizQuestion/);
assert.match(bankSource, /this\.generatedPools\[key\]\.push\(question\.raw\)/);
assert.match(bankSource, /acceptQuizQuestion/);
pass("O wrong questions return to pool");


// P — every grammar task carries an explicit Russian target meaning, old
// translation-less pools are invalidated, and recall evaluation receives it.
const generationSource = fs.readFileSync(new URL("../see-escape-claude-practical-gates-bDFmc/quiz-generation.cjs", import.meta.url), "utf8");
const evaluationSource = fs.readFileSync(new URL("../recall-evaluation.cjs", import.meta.url), "utf8");
assert.match(generationSource, /translationLine/);
assert.match(generationSource, /"translation": "Полный русский перевод/);
assert.match(generationSource, /gueltigen JSON-Array/);
assert.match(generationSource, /verbindliche Zielbedeutung/);
assert.match(bankSource, /Поезд прибывает в 9 часов/);
assert.match(bankSource, /see-escape\.quiz\.pool\.v3/);
assert.match(recognitionSource, /question\.translation/);
assert.match(recallSource, /translation: question\.translation/);
assert.match(evaluationSource, /payload\.translation/);
pass("P Russian target translation");


// Q — the learning selector exposes exactly 50 current topics through C1,
// and the default world is a real EXT_meshopt_compression asset.
const lexicalBlock = bankSource.match(/const LEXICAL_TOPICS = \[([\s\S]*?)\n  \];/);
assert.ok(lexicalBlock);
const lexicalTopics = [...lexicalBlock[1].matchAll(/'([^']+)'/g)].map((match) => match[1]);
assert.equal(lexicalTopics.length, 50);
assert.equal(new Set(lexicalTopics).size, 50);
assert.match(bankSource, /LANGUAGE_LEVELS = \['A1', 'A2', 'B1', 'B2', 'C1'\]/);
assert.match(bankSource, /id="learning-lexical"/);
assert.match(bankSource, /Künstliche Intelligenz/);
assert.match(ASSET_URLS.world, /first_person_world_1k_meshopt\.glb$/);
const assetSource = fs.readFileSync(new URL("../public/js/fps/assets.js", import.meta.url), "utf8");
assert.match(assetSource, /setMeshoptDecoder\(MeshoptDecoder\)/);
const optimizedWorld = fs.readFileSync(new URL("../public/assets/forest_defense/first_person/first_person_world_1k_meshopt.glb", import.meta.url));
assert.ok(optimizedWorld.length < 20 * 1024 * 1024);
const optimizedJsonLength = optimizedWorld.readUInt32LE(12);
const optimizedDocument = JSON.parse(optimizedWorld.subarray(20, 20 + optimizedJsonLength).toString("utf8").trim());
assert.ok(optimizedDocument.extensionsRequired.includes("EXT_meshopt_compression"));
assert.equal(optimizedDocument.nodes.length, 1491);
pass("Q C1 topics and Meshopt world");


// R — weak hardware receives the 512px world and conservative renderer,
// while normal hardware keeps the existing profile. Sustained low FPS is a
// second safety net for machines whose browser hides hardware information.
assert.equal(detectHardwareProfile({ deviceMemory: 2, hardwareConcurrency: 2, screenPixels: 1920 * 1080, devicePixelRatio: 1 }).id, "low");
assert.equal(detectHardwareProfile({ deviceMemory: 16, hardwareConcurrency: 12, screenPixels: 1920 * 1080, devicePixelRatio: 1 }).id, "normal");
assert.equal(detectHardwareProfile({ search: "?quality=high", deviceMemory: 2, hardwareConcurrency: 2 }).id, "low");
assert.equal(detectHardwareProfile({ search: "?performance=normal", deviceMemory: 2, hardwareConcurrency: 2 }).id, "normal");
assert.match(assetUrlsForProfile("low").world, /first_person_world_512_meshopt\.glb$/);
assert.match(assetUrlsForProfile("normal").world, /first_person_world_1k_meshopt\.glb$/);
const frameDetector = new PerformanceDetector({ deviceMemory: 16, hardwareConcurrency: 12 });
let downgraded = false;
for (let frame = 0; frame < 260; frame += 1) downgraded ||= frameDetector.observeFrame(.03, true);
assert.equal(downgraded, true);
assert.equal(frameDetector.profile.id, "low");
const manualDetector = new PerformanceDetector({ search: "?performance=normal", deviceMemory: 2, hardwareConcurrency: 2 });
for (let frame = 0; frame < 300; frame += 1) manualDetector.observeFrame(.04, true);
assert.equal(manualDetector.profile.id, "normal");
assert.equal(shouldKeepDecoration("Undergrowth_004", .38), shouldKeepDecoration("Undergrowth_004", .38));
const lowWorld = fs.readFileSync(new URL("../public/assets/forest_defense/first_person/first_person_world_512_meshopt.glb", import.meta.url));
assert.ok(lowWorld.length < optimizedWorld.length * .6);
const lowJsonLength = lowWorld.readUInt32LE(12);
const lowDocument = JSON.parse(lowWorld.subarray(20, 20 + lowJsonLength).toString("utf8").trim());
assert.ok(lowDocument.extensionsRequired.includes("EXT_meshopt_compression"));
assert.equal(lowDocument.nodes.length, optimizedDocument.nodes.length);
pass("R automatic weak-PC profile");


// S — Waldwacht uses a strict ten-question AI cycle instead of floor-bound
// questions: wrong answers remain, ten correct answers trigger regeneration,
// and malformed/duplicate model output cannot be silently padded by fallback.
const generatedFixture = Array.from({ length: 10 }, (_, index) => ({
  text: "Впиши немецкую форму, чтобы получился указанный перевод.",
  display: `Neue Aufgabe ${index + 1}: Ich ___ heute im Wald.`,
  translation: `Новое задание ${index + 1}: Сегодня я нахожусь в лесу.`,
  options: ["bin", "bist", "seid", "sind"],
  correct: 0,
}));
const parsedFixture = quizGenerationTest.parseJsonQuestions(JSON.stringify(generatedFixture), 10);
assert.equal(parsedFixture.length, 10);
assert.equal(quizGenerationTest.parseJsonQuestions(JSON.stringify([...generatedFixture, generatedFixture[0]]), 20).length, 10);
const strictPrompt = quizGenerationTest.buildSyntheticPrompt({
  level: "A2",
  lexicalTopic: "Natur & Tiere",
  grammarTopic: "weil-Sätze",
  isWortstellung: false,
  questionsCount: 10,
  exclude: ["Ich bleibe zu Hause, weil ..."],
  topicRule: "Das finite Verb steht am Ende.",
});
assert.match(strictPrompt, /gueltigen JSON-Array/);
assert.match(strictPrompt, /exakt 10 neue Objekte/);
assert.match(strictPrompt, /Ich bleibe zu Hause/);
assert.match(bankSource, /const WALD_POOL_SIZE = 10/);
assert.match(bankSource, /poolCorrect\[key\] % this\.poolSize === 0/);
assert.match(bankSource, /strict: true/);
assert.match(bankSource, /resumed: true/);
const directTakeBlock = bankSource.match(/takeFromPool\([\s\S]*?takeAudioFromPool/);
assert.ok(directTakeBlock);
assert.doesNotMatch(directTakeBlock[0], /saveRestartPoolSnapshot/);
assert.doesNotMatch(generationSource, /const questionPool =/);
assert.match(generationSource, /exclude\.slice\(-80\)/);
assert.match(recognitionSource, /poolMode: true/);
assert.doesNotMatch(recognitionSource, /const quizContext = \{ floor/);
assert.match(recallSource, /poolMode: true/);
pass("S strict ten-question AI cycle");


console.log(`FIRST_PERSON_LOGIC_OK ${passed.length}/21`);
console.log(passed.join(" | "));
