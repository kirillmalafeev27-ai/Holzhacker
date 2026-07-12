import * as THREE from "three";
import { CONFIG } from "./config.js";


const STAGES = ["tree0", "tree25", "tree50", "tree75", "tree90", "treeFallen"];

// The authored fall from tree_chop_simulation.blend (24 fps, frames 102-144):
// the crown hinges on the rear wood at Blender (-0.23, -0.27, 1.27) and tips
// away from the notch, hits the ground at 88 deg, bounces to 84 and settles
// at 87. Times are seconds since the fourth axe impact.
const FALL_TIMES = [0, .333, .5, .833, 1.25, 1.417, 1.625, 1.75];
const FALL_ANGLES = [0, 0, 4, 27, 61, 88, 84, 87].map((deg) => deg * Math.PI / 180);
const FALL_HINGE = new THREE.Vector3(-.23, 1.27, .27);
const FALL_FINAL_ANGLE = FALL_ANGLES[FALL_ANGLES.length - 1];
const FALL_SWAP_TIME = FALL_TIMES[1];
const FALL_IMPACT_TIME = 1.417;

// Piecewise cubic Hermite with Catmull-Rom tangents — matches the Blender
// bezier interpolation closely enough to keep the authored motion.
function sampleFallAngle(time) {
  const last = FALL_TIMES.length - 1;
  if (time <= FALL_TIMES[0]) return FALL_ANGLES[0];
  if (time >= FALL_TIMES[last]) return FALL_ANGLES[last];
  let index = 0;
  while (time > FALL_TIMES[index + 1]) index += 1;
  const t0 = FALL_TIMES[index], t1 = FALL_TIMES[index + 1];
  const p0 = FALL_ANGLES[index], p1 = FALL_ANGLES[index + 1];
  const dt = t1 - t0;
  const prevT = index > 0 ? FALL_TIMES[index - 1] : t0 - dt;
  const prevP = index > 0 ? FALL_ANGLES[index - 1] : p0;
  const nextT = index + 2 <= last ? FALL_TIMES[index + 2] : t1 + dt;
  const nextP = index + 2 <= last ? FALL_ANGLES[index + 2] : p1;
  const m0 = (p1 - prevP) / (t1 - prevT) * dt;
  const m1 = (nextP - p0) / (nextT - t0) * dt;
  const s = (time - t0) / dt;
  const s2 = s * s, s3 = s2 * s;
  return (2 * s3 - 3 * s2 + 1) * p0 + (s3 - 2 * s2 + s) * m0 + (-2 * s3 + 3 * s2) * p1 + (s3 - s2) * m1;
}


export class ChoppingSystem {
  constructor(scene, assets, player, effects, audio) {
    this.scene = scene;
    this.assets = assets;
    this.player = player;
    this.effects = effects;
    this.audio = audio;
    this.trees = [];
    this.logs = [];
    this.activeTree = null;
    this.spawnTrees();
  }

  spawnTrees() {
    for (let index = 1; index <= CONFIG.CHOP.TREE_COUNT; index += 1) {
      const marker = this.assets.markerPosition(`ChoppableTreeSpawn_${String(index).padStart(2, "0")}`);
      if (!marker) continue;
      const root = new THREE.Group();
      root.name = `ChoppableTree_${index}`;
      root.position.copy(marker);
      const models = STAGES.map((key) => {
        const model = this.assets.clone(key);
        model.visible = false;
        root.add(model);
        return model;
      });
      models[0].visible = true;
      root.userData.choppable = true;
      this.scene.add(root);
      const fallenCrown = models[5].getObjectByName("TreeCrownFallen") || null;
      this.trees.push({
        id: index, root, models, hits: 0, state: "standing",
        fallTime: 0, lyingTime: 0, log: null,
        fallenCrown,
        fallPivot: fallenCrown ? this.buildFallHinge(models[5], fallenCrown) : null,
        crownSwapped: false, impactPlayed: false,
      });
    }
  }

  // Re-hang the exported (settled) crown on the authored rear-wood hinge so
  // the original Blender fall animation can be replayed: at angle 0 the crown
  // stands exactly on the stump, at FALL_FINAL_ANGLE it matches the export.
  buildFallHinge(fallenModel, crown) {
    const pivot = new THREE.Group();
    pivot.name = "FallHinge";
    pivot.position.copy(FALL_HINGE);
    const settled = new THREE.Matrix4()
      .makeTranslation(FALL_HINGE.x, FALL_HINGE.y, FALL_HINGE.z)
      .multiply(new THREE.Matrix4().makeRotationZ(FALL_FINAL_ANGLE));
    crown.updateMatrix();
    crown.applyMatrix4(settled.invert());
    fallenModel.add(pivot);
    pivot.add(crown);
    pivot.rotation.z = FALL_FINAL_ANGLE;
    return pivot;
  }

  collisionData() {
    return this.trees.map((tree) => ({
      position: tree.root.position,
      radius: .78,
      kind: "choppableTree",
    }));
  }

  nearestInteractable(position, forward) {
    let best = null;
    let score = Infinity;
    for (const tree of this.trees) {
      if (tree.state !== "standing") continue;
      const to = tree.root.position.clone().sub(position);
      const distance = to.length();
      const facing = forward.dot(to.normalize());
      if (distance <= CONFIG.PLAYER.INTERACTION_DISTANCE && facing > .46) {
        const current = distance - facing * .7;
        if (current < score) { score = current; best = { type: "tree", tree }; }
      }
    }
    for (const log of this.logs) {
      if (log.collected) continue;
      const distance = log.object.position.distanceTo(position);
      if (distance < 2.4 && distance < score) { score = distance; best = { type: "log", log }; }
    }
    return best;
  }

  chop(tree) {
    if (tree.state !== "standing" || this.player.carrying) return false;
    return this.player.rig.startSwing(() => this.applyHit(tree));
  }

  applyHit(tree) {
    if (tree.state !== "standing") return;
    this.audio.play("axe");
    tree.hits += 1;
    // The notch is authored on the model's local +X side: turn the trunk so
    // the cut always opens toward the side the player is chopping from.
    this.faceNotchToPlayer(tree);
    const notchDirection = new THREE.Vector3(Math.cos(tree.root.rotation.y), 0, -Math.sin(tree.root.rotation.y));
    const impact = tree.root.position.clone().addScaledVector(notchDirection, .55).add(new THREE.Vector3(0, 1.05, 0));
    this.effects.woodBurst(impact);
    this.showStage(tree, Math.min(tree.hits, 4));
    if (tree.hits >= CONFIG.CHOP.HITS) {
      tree.state = "falling";
      tree.fallTime = 0;
      tree.crownSwapped = false;
      tree.impactPlayed = false;
    }
  }

  faceNotchToPlayer(tree) {
    const playerPosition = this.player?.position;
    if (!playerPosition) return;
    const dx = playerPosition.x - tree.root.position.x;
    const dz = playerPosition.z - tree.root.position.z;
    if (Math.hypot(dx, dz) < .001) return;
    tree.root.rotation.y = Math.atan2(-dz, dx);
  }

  fallDirection(tree, target = new THREE.Vector3()) {
    // Local -X (opposite the notch, i.e. away from the player) in world space.
    return target.set(-Math.cos(tree.root.rotation.y), 0, Math.sin(tree.root.rotation.y));
  }

  showStage(tree, stageIndex) {
    tree.models.forEach((model, index) => { model.visible = index === stageIndex; });
  }

  update(dt) {
    for (const tree of this.trees) {
      if (tree.state === "falling") {
        tree.fallTime += dt;
        // Replay the authored Blender fall: swap the stage-90 trunk for the
        // hinged stump+crown, then drive the hinge along the keyframed curve
        // (ground hit at 88 deg, bounce, settle at 87 deg).
        if (tree.fallPivot) {
          if (!tree.crownSwapped && tree.fallTime >= FALL_SWAP_TIME) {
            tree.crownSwapped = true;
            tree.fallPivot.rotation.z = 0;
            this.showStage(tree, 5);
          }
          if (tree.crownSwapped) tree.fallPivot.rotation.z = sampleFallAngle(tree.fallTime);
        }
        if (!tree.impactPlayed && tree.fallTime >= FALL_IMPACT_TIME) {
          tree.impactPlayed = true;
          this.effects.groundImpact(tree.root.position.clone().addScaledVector(this.fallDirection(tree), 3.1));
          this.audio.play("impact");
        }
        if (tree.fallTime < CONFIG.CHOP.FALL_DURATION) continue;
        if (tree.fallPivot) tree.fallPivot.rotation.z = FALL_FINAL_ANGLE;
        this.showStage(tree, 5);
        tree.state = "fallen";
        tree.lyingTime = 0;
      } else if (tree.state === "fallen") {
        tree.lyingTime += dt;
        if (tree.lyingTime < CONFIG.CHOP.TRUNK_LINGER_SECONDS) continue;
        if (tree.fallenCrown) tree.fallenCrown.visible = false;
        tree.state = "cleared";
        this.spawnLog(tree);
      }
    }
  }

  spawnLog(tree) {
    const direction = this.fallDirection(tree);
    const object = this.assets.clone("log");
    object.position.copy(tree.root.position).addScaledVector(direction, CONFIG.CHOP.LOG_DISTANCE).add(new THREE.Vector3(0, .09, 0));
    // log_large is long along its local X axis; lay it along the fallen trunk.
    object.rotation.y = Math.atan2(-direction.z, direction.x);
    object.scale.set(3.3, 1.7, 1.7);
    this.scene.add(object);
    this.effects.woodBurst(object.position.clone().add(new THREE.Vector3(0, .5, 0)));
    const log = { id: `tree-log-${tree.id}`, object, collected: false };
    tree.log = log;
    this.logs.push(log);
  }

  pickup(log) {
    if (this.player.carrying || log.collected) return false;
    log.collected = true;
    log.object.visible = false;
    this.player.setCarrying(true);
    this.audio.play("pickup");
    return true;
  }

  consumeCarriedLog() {
    if (!this.player.carrying) return false;
    this.player.setCarrying(false);
    return true;
  }
}
