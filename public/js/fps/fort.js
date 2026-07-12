import * as THREE from "three";
import { CONFIG } from "./config.js";


export class FortSystem {
  constructor(scene, assets, navigation, effects) {
    this.scene = scene;
    this.assets = assets;
    this.navigation = navigation;
    this.effects = effects;
    this.stage = 0;
    this.health = CONFIG.BUILD.MAX_HEALTH;
    this.maxHealth = CONFIG.BUILD.MAX_HEALTH;
    this.gateOpen = true;
    this.gateState = "open";
    this.gateAnimation = 1;
    this.groups = [null, assets.clone("fort1"), assets.clone("fort2"), assets.clone("fort3")];
    for (let stage = 1; stage <= 3; stage += 1) {
      const group = this.groups[stage];
      group.name = `FortStage_${stage}`;
      group.visible = false;
      group.traverse((object) => {
        if (object.isMesh) {
          object.castShadow = true;
          object.receiveShadow = true;
        }
      });
      scene.add(group);
    }
    this.gateLeft = null;
    this.gateRight = null;
    this.damageMeshes = [];
    this.collectStageThreeParts();
    this.shrinkTowerRailing();
    this.onStageChanged = () => {};
    this.onHealthChanged = () => {};
    this.onGateChanged = () => {};
  }

  collectStageThreeParts() {
    const group = this.groups[3];
    group.traverse((object) => {
      const clean = object.name.replace(/\.\d+$/, "");
      if (clean === "GateLeftPivot") this.gateLeft = object;
      if (clean === "GateRightPivot") this.gateRight = object;
      if (/PalisadePost|GateReinforcedPost/.test(clean) && object.isMesh) this.damageMeshes.push(object);
    });
  }

  shrinkTowerRailing() {
    // The authored parapet reaches eye height on the platform; cut it down so
    // the player can aim and throw stones over it.
    this.groups[3]?.traverse((object) => {
      const clean = object.name.replace(/\.\d+$/, "");
      if (/^TowerRailPost_/.test(clean)) {
        object.scale.y *= .45;
        object.position.y -= .33;
      } else if (/^TowerRail_/.test(clean)) {
        object.position.y -= .54;
      }
    });
  }

  buildNext() {
    if (this.stage >= 3) return false;
    const previous = this.groups[this.stage];
    if (previous) previous.visible = false;
    this.stage += 1;
    const current = this.groups[this.stage];
    current.visible = true;
    current.scale.set(1, .015, 1);
    current.userData.buildProgress = 0;
    this.effects?.constructionBurst(new THREE.Vector3(0, .3, 0), 42);
    if (this.stage === 3) {
      this.gateOpen = true;
      this.gateState = "closing";
      this.gateAnimation = 1;
      if (this.gateLeft) this.gateLeft.rotation.y = -1.25;
      if (this.gateRight) this.gateRight.rotation.y = 1.25;
    }
    this.navigation.switchState(this.stage, this.gateOpen);
    this.onStageChanged(this.stage);
    return true;
  }

  update(dt) {
    const current = this.groups[this.stage];
    if (current?.userData.buildProgress < 1) {
      current.userData.buildProgress = Math.min(1, current.userData.buildProgress + dt / 1.35);
      const p = 1 - Math.pow(1 - current.userData.buildProgress, 3);
      current.scale.y = Math.max(.015, p);
    }
    if (this.stage < 3 || this.gateState === "open" || this.gateState === "closed") return;
    const direction = this.gateState === "opening" ? 1 : -1;
    this.gateAnimation = THREE.MathUtils.clamp(this.gateAnimation + direction * dt * 1.25, 0, 1);
    const eased = 1 - Math.pow(1 - this.gateAnimation, 3);
    if (this.gateLeft) this.gateLeft.rotation.y = eased * -1.25;
    if (this.gateRight) this.gateRight.rotation.y = eased * 1.25;
    if (this.gateAnimation <= 0) {
      this.gateState = "closed";
      this.gateOpen = false;
      this.navigation.switchState(3, false);
      this.onGateChanged(false);
    } else if (this.gateAnimation >= 1) {
      this.gateState = "open";
      this.gateOpen = true;
      this.navigation.switchState(3, true);
      this.onGateChanged(true);
    }
  }

  toggleGate() {
    if (this.stage < 3 || this.gateState === "opening" || this.gateState === "closing") return false;
    this.gateState = this.gateOpen ? "closing" : "opening";
    return true;
  }

  damage(amount) {
    if (this.stage <= 0 || this.health <= 0) return false;
    this.health = Math.max(0, this.health - amount);
    this.applyDamageVisuals();
    this.navigation.setWallDamageRatio(1 - this.health / this.maxHealth);
    this.onHealthChanged(this.health, -amount);
    return true;
  }

  repair() {
    if (this.health >= this.maxHealth) return 0;
    const before = this.health;
    this.health = Math.min(this.maxHealth, this.health + CONFIG.BUILD.REPAIR_PER_LOG);
    this.applyDamageVisuals();
    this.effects?.repairBurst(new THREE.Vector3(0, 1, 8.4));
    this.onHealthChanged(this.health, this.health - before);
    return this.health - before;
  }

  applyDamageVisuals() {
    const ratio = 1 - this.health / this.maxHealth;
    for (let index = 0; index < this.damageMeshes.length; index += 1) {
      const mesh = this.damageMeshes[index];
      if (!mesh.userData.originalMaterial) mesh.userData.originalMaterial = mesh.material;
      if (!mesh.userData.originalColor && mesh.material?.color) mesh.userData.originalColor = mesh.material.color.clone();
      if (ratio > .25 && mesh.material === mesh.userData.originalMaterial) mesh.material = mesh.material.clone();
      if (ratio > .25) {
        if (mesh.userData.originalColor) mesh.material.color.copy(mesh.userData.originalColor).offsetHSL(0, -ratio * .12, -ratio * .16);
        mesh.rotation.z = index % Math.max(3, Math.floor(9 - ratio * 6)) === 0 ? (index % 2 ? -.04 : .04) * ratio * 5 : 0;
      } else {
        mesh.material = mesh.userData.originalMaterial;
        mesh.rotation.z = 0;
      }
    }
  }

  resolvePlayerCollision(next, previous) {
    if (this.stage <= 0) return;
    const newRadius = Math.hypot(next.x, next.z);
    const oldRadius = Math.hypot(previous.x, previous.z);
    // Block any position inside the wall band, not just radial crossings —
    // otherwise the band can be entered through the unbuilt gap and exited
    // straight through the logs.
    const insideBand = newRadius >= CONFIG.BUILD.WALL_INNER_RADIUS && newRadius <= CONFIG.BUILD.WALL_OUTER_RADIUS;
    const jumpedBand = (oldRadius < CONFIG.BUILD.WALL_INNER_RADIUS && newRadius > CONFIG.BUILD.WALL_OUTER_RADIUS)
      || (oldRadius > CONFIG.BUILD.WALL_OUTER_RADIUS && newRadius < CONFIG.BUILD.WALL_INNER_RADIUS);
    if (!insideBand && !jumpedBand) return;
    if (this.stage < 3 && !this.withinBuiltArc(next)) return;
    const throughGate = this.stage >= 2 && Math.abs(next.x) < 2.05 && next.z > 8.4 && (this.stage < 3 || this.gateOpen);
    if (!throughGate) next.copy(previous);
  }

  withinBuiltArc(position) {
    // The fort assets were authored in Blender XY. glTF maps Blender +Y to
    // Three.js -Z, so convert the player angle back before comparing it to
    // the exact authored construction arc.
    const blenderAngle = Math.atan2(-position.z, position.x);
    const start = -Math.PI / 2 + .25;
    const span = Math.PI * 2 - .50;
    const delta = (blenderAngle - start + Math.PI * 2) % (Math.PI * 2);
    const fraction = this.stage === 1 ? .34 : .68;
    return delta <= span * fraction;
  }

  nearGate(position) {
    return this.stage >= 2 && position.distanceTo(new THREE.Vector3(0, position.y, 9.5)) < 3.2;
  }

  nearRepair(position) {
    return this.stage === 3 && position.distanceTo(new THREE.Vector3(0, position.y, 7.4)) < 2.8;
  }

  nearTower(position) {
    return this.stage === 3 && position.distanceTo(new THREE.Vector3(4.7, position.y, -3.9)) < 2.7;
  }

  towerPosition(target = new THREE.Vector3()) {
    return target.set(4.7, 7.35, -3.9);
  }

  attackPoints() {
    return this.navigation.attackPoints;
  }
}
