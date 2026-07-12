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
      this.trees.push({
        id: index, root, models, hits: 0, state: "standing",
        fallTime: 0, lyingTime: 0, log: null,
        fallenCrown: models[5].getObjectByName("TreeCrownFallen") || null,
      });
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
        const t = Math.min(1, tree.fallTime / CONFIG.CHOP.FALL_DURATION);
        const eased = 1 - Math.pow(1 - t, 3);
        // Positive Z spin tips the trunk toward local -X: away from the player.
        tree.models[4].rotation.z = eased * 1.36;
        if (t < 1) continue;
        tree.models[4].rotation.z = 0;
        this.showStage(tree, 5);
        // The fallen crown was authored lying toward +X; flip it to match the
        // actual fall direction.
        tree.models[5].rotation.y = Math.PI;
        tree.state = "fallen";
        tree.lyingTime = 0;
        this.effects.groundImpact(tree.root.position.clone().addScaledVector(this.fallDirection(tree), 2.8));
        this.audio.play("impact");
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
