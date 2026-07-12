import assert from "node:assert/strict";
import * as THREE from "three";
import { CONFIG, runtimeConfig } from "../public/js/fps/config.js";
import { ChoppingSystem } from "../public/js/fps/chopping.js";
import { NoteSystem } from "../public/js/fps/notes.js";
import { FortSystem } from "../public/js/fps/fort.js";
import { NavigationSystem } from "../public/js/fps/navigation.js";
import { ProjectileSystem } from "../public/js/fps/projectiles.js";


const passed = [];
const pass = (name) => passed.push(name);
const silentAudio = { play() {} };
const silentEffects = {
  woodBurst() {}, groundImpact() {}, constructionBurst() {}, repairBurst() {},
};


// A — deployment/dev flags never speed up the production simulation.
globalThis.location = { search: "?demo=1&preset=tree&navdebug=1" };
const runtime = runtimeConfig();
assert.equal(runtime.dev, true);
assert.equal(runtime.demo, true);
assert.equal(runtime.preset, "tree");
assert.equal(runtime.timeScale, 1);
pass("A runtime modes");


// B — all 12 compatible oaks use the preserved four-hit damage sequence.
const chopScene = new THREE.Group();
const chopAssets = {
  markerPosition(name) {
    const index = Number(name.slice(-2));
    return index >= 1 && index <= CONFIG.CHOP.TREE_COUNT ? new THREE.Vector3(index * 2, 0, 0) : null;
  },
  clone() { return new THREE.Group(); },
};
const chopPlayer = {
  carrying: false,
  position: new THREE.Vector3(2, CONFIG.PLAYER.EYE_HEIGHT, -3),
  rig: { startSwing(onImpact) { onImpact(); return true; } },
  setCarrying(value) { this.carrying = value; },
};
const chopping = new ChoppingSystem(chopScene, chopAssets, chopPlayer, silentEffects, silentAudio);
assert.equal(chopping.trees.length, 12);
const tree = chopping.trees[0];
for (let hit = 0; hit < 4; hit += 1) assert.equal(chopping.chop(tree), true);
assert.equal(tree.hits, 4);
assert.equal(tree.state, "falling");
assert.equal(tree.models[4].visible, true);
// The notch turns toward the player, so the trunk must fall the other way.
const toPlayer = chopPlayer.position.clone().sub(tree.root.position).setY(0).normalize();
chopping.update(CONFIG.CHOP.FALL_DURATION + .1);
assert.equal(tree.state, "fallen");
assert.equal(tree.models[5].visible, true);
const fallDirection = chopping.fallDirection(tree);
assert.ok(fallDirection.dot(toPlayer) < -.99);
// The trunk lingers before it is replaced with one big log.
assert.equal(chopping.logs.length, 0);
chopping.update(CONFIG.CHOP.TRUNK_LINGER_SECONDS + .1);
assert.equal(tree.state, "cleared");
assert.equal(chopping.logs.length, 1);
const logOffset = chopping.logs[0].object.position.clone().sub(tree.root.position).setY(0);
assert.ok(logOffset.normalize().dot(fallDirection) > .99);
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
assert.equal(notes.collected, 2);
assert.equal(collected, 2);
pass("C note pickup");


// D — construction changes navmesh on every stage and closes the final gate.
function fortAsset(key) {
  const group = new THREE.Group();
  if (key === "fort3") {
    const left = new THREE.Group(); left.name = "GateLeftPivot";
    const right = new THREE.Group(); right.name = "GateRightPivot";
    const wall = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0x83512e }));
    wall.name = "PalisadePost_001";
    group.add(left, right, wall);
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
for (let stage = 1; stage <= 3; stage += 1) {
  assert.equal(fort.buildNext(), true);
  fort.update(2);
}
assert.equal(fort.stage, 3);
assert.equal(fort.gateState, "closed");
assert.equal(fort.gateOpen, false);
assert.deepEqual(navSwitches.slice(0, 3).map(([stage]) => stage), [1, 2, 3]);
assert.deepEqual(navSwitches.at(-1), [3, false]);
fort.damage(500);
assert.equal(fort.health, 500);
assert.equal(fort.repair(), CONFIG.BUILD.REPAIR_PER_LOG);
assert.equal(fort.health, 750);
pass("D fort and gate navigation");


// D2 — stage-1 palisade logs are solid: no radial pass and no sneaking out
// through the built arc after entering the band via the unbuilt gap.
const stageOneFort = new FortSystem(new THREE.Group(), { clone: fortAsset }, fortNavigation, silentEffects);
stageOneFort.buildNext();
assert.equal(stageOneFort.stage, 1);
const wallRadius = (CONFIG.BUILD.WALL_INNER_RADIUS + CONFIG.BUILD.WALL_OUTER_RADIUS) / 2;
// Blender angle .35 rad lies inside the stage-1 arc; three.js z = -sin(angle).
const builtAngle = .35;
const radialPrevious = new THREE.Vector3(Math.cos(builtAngle) * 9.0, 0, -Math.sin(builtAngle) * 9.0);
const radialNext = new THREE.Vector3(Math.cos(builtAngle) * 9.4, 0, -Math.sin(builtAngle) * 9.4);
stageOneFort.resolvePlayerCollision(radialNext, radialPrevious);
assert.ok(radialNext.distanceTo(radialPrevious) < 1e-9);
// Tangential move inside the band into the built arc must also be blocked.
const gapAngle = 3.0; // outside the stage-1 arc
const tangentialPrevious = new THREE.Vector3(Math.cos(gapAngle) * wallRadius, 0, -Math.sin(gapAngle) * wallRadius);
const tangentialNext = new THREE.Vector3(Math.cos(builtAngle) * wallRadius, 0, -Math.sin(builtAngle) * wallRadius);
stageOneFort.resolvePlayerCollision(tangentialNext, tangentialPrevious);
assert.ok(tangentialNext.distanceTo(tangentialPrevious) < 1e-9);
// The unbuilt gap stays passable at stage 1.
const gapPrevious = new THREE.Vector3(Math.cos(gapAngle) * 9.0, 0, -Math.sin(gapAngle) * 9.0);
const gapNext = new THREE.Vector3(Math.cos(gapAngle) * 9.4, 0, -Math.sin(gapAngle) * 9.4);
stageOneFort.resolvePlayerCollision(gapNext, gapPrevious);
assert.ok(gapNext.distanceTo(gapPrevious) > .3);
pass("D2 stage-1 wall is solid");


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


console.log(`FIRST_PERSON_LOGIC_OK ${passed.length}/7`);
console.log(passed.join(" | "));

