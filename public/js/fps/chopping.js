import * as THREE from "three";
import { CONFIG } from "./config.js";


const STAGES = ["tree0", "tree25", "tree50", "tree75", "tree90", "treeFallen"];
const AUTHORED_FALL_KEYS = [
  [0, 0], [4 / 34, 4], [12 / 34, 27], [22 / 34, 61],
  [26 / 34, 88], [31 / 34, 84], [1, 87],
];
const FALL_HINGE = new THREE.Vector3(-.23, 1.27, 0);
const FALL_AXIS = new THREE.Vector3(0, 0, 1);


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
      this.trees.push({
        id: index, root, models, hits: 0, state: "standing", fallTime: 0,
        fallenTime: 0, log: null, chopYaw: null,
        correctAnswers: 0, hitCredits: 0,
        fallenCrown: models[5].getObjectByName("TreeCrownFallen"),
        fallenStump: models[5].getObjectByName("TreeStump"),
      });
    }
  }

  collisionData() {
    return this.trees.map((tree) => ({
      position: tree.root.position,
      radius: .78,
      kind: "choppableTree",
      ref: tree,
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
    if (tree.state !== "standing" || this.player.carrying || tree.hitCredits <= 0) return false;
    this.activeTree = tree;
    this.orientCut(tree);
    const started = this.player.rig.startSwing(() => this.applyHit(tree));
    if (started) tree.hitCredits = Math.max(0, tree.hitCredits - 1);
    return started;
  }

  orientCut(tree) {
    if (tree.chopYaw !== null) return;
    const towardPlayer = this.player.position.clone().sub(tree.root.position).setY(0);
    if (towardPlayer.lengthSq() < 1e-6) towardPlayer.set(1, 0, 0);
    towardPlayer.normalize();
    tree.chopYaw = Math.atan2(-towardPlayer.z, towardPlayer.x);
    tree.root.rotation.y = tree.chopYaw;
  }

  nextQuizHitGrant(tree) {
    if (!tree || tree.state !== "standing") return 0;
    if (tree.hitCredits > 0 || tree.correctAnswers >= 2) return 0;
    const remaining = Math.max(0, CONFIG.CHOP.HITS - tree.hits);
    return tree.correctAnswers === 0
      ? Math.min(CONFIG.CHOP.FIRST_ANSWER_HITS, remaining)
      : remaining;
  }

  grantQuizHits(tree) {
    if (!tree || tree.state !== "standing") return 0;
    const hits = this.nextQuizHitGrant(tree);
    if (!hits) return 0;
    tree.correctAnswers += 1;
    tree.hitCredits += hits;
    this.activeTree = tree;
    return hits;
  }

  progress(tree = this.activeTree) {
    if (!tree || tree.state !== "standing" || (!tree.correctAnswers && !tree.hits && !tree.hitCredits)) return null;
    return {
      tree,
      state: tree.state,
      hits: tree.hits,
      hitCredits: tree.hitCredits,
      remainingHits: Math.max(0, CONFIG.CHOP.HITS - tree.hits),
      ratio: tree.hits / CONFIG.CHOP.HITS,
      nextGrant: this.nextQuizHitGrant(tree),
    };
  }

  applyHit(tree) {
    if (tree.state !== "standing") return;
    this.audio.play("axe");
    this.orientCut(tree);
    tree.hits += 1;
    const cutSide = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), tree.root.rotation.y);
    const impact = tree.root.position.clone().addScaledVector(cutSide, .33).add(new THREE.Vector3(0, 1.05, 0));
    this.effects.woodBurst(impact);
    this.showStage(tree, Math.min(tree.hits, 4));
    if (tree.hits >= CONFIG.CHOP.HITS) {
      tree.state = "falling";
      tree.fallTime = 0;
      if (this.activeTree === tree) this.activeTree = null;
      this.showStage(tree, 5);
      this.setFallAngle(tree, 0);
    }
  }

  showStage(tree, stageIndex) {
    tree.models.forEach((model, index) => { model.visible = index === stageIndex; });
  }

  update(dt) {
    for (const tree of this.trees) {
      if (tree.state === "falling") {
        tree.fallTime += dt;
        const t = Math.min(1, tree.fallTime / CONFIG.CHOP.FALL_DURATION);
        this.setFallAngle(tree, this.authoredFallDegrees(t));
        if (t < 1) continue;
        tree.state = "fallen";
        tree.fallenTime = 0;
        const away = this.fallDirection(tree);
        this.effects.groundImpact(tree.root.position.clone().addScaledVector(away, 2.8));
        this.audio.play("impact");
      } else if (tree.state === "fallen") {
        tree.fallenTime += dt;
        if (tree.fallenTime < CONFIG.CHOP.TRUNK_LINGER_SECONDS) continue;
        if (tree.fallenCrown) tree.fallenCrown.visible = false;
        tree.state = "cleared";
        this.spawnLog(tree);
      }
    }
  }

  authoredFallDegrees(t) {
    for (let index = 1; index < AUTHORED_FALL_KEYS.length; index += 1) {
      const [endT, endValue] = AUTHORED_FALL_KEYS[index];
      const [startT, startValue] = AUTHORED_FALL_KEYS[index - 1];
      if (t > endT) continue;
      const local = THREE.MathUtils.clamp((t - startT) / (endT - startT), 0, 1);
      const bezier = local * local * (3 - 2 * local);
      return THREE.MathUtils.lerp(startValue, endValue, bezier);
    }
    return AUTHORED_FALL_KEYS.at(-1)[1];
  }

  setFallAngle(tree, degrees) {
    if (!tree.fallenCrown) return;
    const angle = THREE.MathUtils.degToRad(degrees);
    tree.fallenCrown.rotation.set(0, 0, angle);
    const rotatedHinge = FALL_HINGE.clone().applyAxisAngle(FALL_AXIS, angle);
    tree.fallenCrown.position.copy(FALL_HINGE).sub(rotatedHinge);
  }

  fallDirection(tree) {
    return new THREE.Vector3(-1, 0, 0)
      .applyAxisAngle(new THREE.Vector3(0, 1, 0), tree.root.rotation.y)
      .normalize();
  }

  spawnLog(tree) {
    const object = this.assets.clone("log");
    object.position.copy(tree.root.position)
      .addScaledVector(this.fallDirection(tree), CONFIG.CHOP.LOG_DISTANCE)
      .add(new THREE.Vector3(0, .28, 0));
    object.rotation.y = tree.root.rotation.y;
    // log_large.glb is authored as a 1 m long cylinder. Stretch only its
    // longitudinal X axis: half of LOG_LENGTH equals LOG_DISTANCE, so the
    // near end begins at the stump instead of leaving a visible gap.
    object.scale.set(CONFIG.CHOP.LOG_LENGTH, CONFIG.CHOP.LOG_THICKNESS, CONFIG.CHOP.LOG_THICKNESS);
    this.scene.add(object);
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
