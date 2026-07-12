import * as THREE from "three";
import { CONFIG } from "./config.js";


const STAGES = ["tree0", "tree25", "tree50", "tree75", "tree90", "treeFallen"];


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
      this.trees.push({ id: index, root, models, hits: 0, state: "standing", fallTime: 0, log: null });
    }
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
    const impact = tree.root.position.clone().add(new THREE.Vector3(0, 1.05, 0));
    this.effects.woodBurst(impact);
    this.showStage(tree, Math.min(tree.hits, 4));
    if (tree.hits >= CONFIG.CHOP.HITS) {
      tree.state = "falling";
      tree.fallTime = 0;
    }
  }

  showStage(tree, stageIndex) {
    tree.models.forEach((model, index) => { model.visible = index === stageIndex; });
  }

  update(dt) {
    for (const tree of this.trees) {
      if (tree.state !== "falling") continue;
      tree.fallTime += dt;
      const t = Math.min(1, tree.fallTime / CONFIG.CHOP.FALL_DURATION);
      const eased = 1 - Math.pow(1 - t, 3);
      tree.models[4].rotation.z = -eased * 1.36;
      if (t < 1) continue;
      tree.models[4].rotation.z = 0;
      this.showStage(tree, 5);
      tree.state = "fallen";
      this.spawnLog(tree);
      this.effects.groundImpact(tree.root.position.clone().add(new THREE.Vector3(2.8, 0, 0)));
      this.audio.play("impact");
    }
  }

  spawnLog(tree) {
    const object = this.assets.clone("log");
    object.position.copy(tree.root.position).add(new THREE.Vector3(1.25, .28, .7));
    object.rotation.y = .55;
    object.scale.setScalar(1.35);
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
