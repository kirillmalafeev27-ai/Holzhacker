import * as THREE from "three";
import { CONFIG } from "./config.js";
import { sweepAabb, sweepCircle } from "./player.js";


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
    this.interiorColliders = this.collectInteriorColliders();
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
      if (clean === "RepairBench" || /^RepairLog_/.test(clean)) object.visible = false;
      if (/PalisadePost|GateReinforcedPost/.test(clean) && object.isMesh) this.damageMeshes.push(object);
      if (/^TowerRailPost_/.test(clean)) {
        // Keep every post planted in the platform and shorten only its
        // vertical axis. Uniform scaling made it thinner but left the top bar
        // at eye level because the node centre did not move.
        object.scale.y *= CONFIG.TOWER.RAIL_HEIGHT / 1.2;
        object.position.y = CONFIG.TOWER.PLATFORM_TOP + CONFIG.TOWER.RAIL_HEIGHT / 2;
      }
      if (/^TowerRail_/.test(clean)) {
        object.position.y = CONFIG.TOWER.PLATFORM_TOP + CONFIG.TOWER.RAIL_HEIGHT;
      }
      if (/^TowerRoof$/.test(clean)) {
        object.scale.x *= CONFIG.TOWER.ROOF_SCALE_XZ;
        object.scale.z *= CONFIG.TOWER.ROOF_SCALE_XZ;
        object.scale.y *= CONFIG.TOWER.ROOF_SCALE_Y;
        object.position.y += CONFIG.TOWER.ROOF_RAISE;
        this.prepareRoofUnderside(object);
      }
      if (/WorkshopRoof|StorehouseRoof/.test(clean)) {
        object.scale.x *= CONFIG.FORT_BUILDINGS.ROOF_SCALE_X;
        object.scale.z *= CONFIG.FORT_BUILDINGS.ROOF_SCALE_Z;
        object.scale.y *= CONFIG.FORT_BUILDINGS.ROOF_SCALE_Y;
        this.prepareRoofUnderside(object, CONFIG.FORT_BUILDINGS.ROOF_COLOR);
      }
    });
    this.addRoofRidge(group, "WorkshopRoofLeft", "WorkshopRoofRight", "WorkshopRoofRidge");
    this.addRoofRidge(group, "StorehouseRoofLeft", "StorehouseRoofRight", "StorehouseRoofRidge");
  }

  prepareRoofUnderside(object, color=null) {
    if (!object.isMesh || !object.material) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    const prepared = materials.map((material) => {
      const clone = material.clone();
      clone.side = THREE.DoubleSide;
      clone.shadowSide = THREE.DoubleSide;
      if (clone.color) {
        if (color !== null) clone.color.setHex(color);
        else clone.color.offsetHSL(0, -.03, .055);
      }
      clone.roughness = Math.max(.9, clone.roughness ?? .9);
      clone.metalness = 0;
      return clone;
    });
    object.material = Array.isArray(object.material) ? prepared : prepared[0];
  }

  addRoofRidge(group, leftName, rightName, ridgeName) {
    const left = group.getObjectByName(leftName);
    const right = group.getObjectByName(rightName);
    if (!left || !right) return;
    group.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(left).union(new THREE.Box3().setFromObject(right));
    const center = bounds.getCenter(new THREE.Vector3());
    const size = bounds.getSize(new THREE.Vector3());
    const material = new THREE.MeshStandardMaterial({ color: 0x2d1b12, roughness: .94, metalness: 0 });
    const ridge = new THREE.Mesh(new THREE.BoxGeometry(.18, .16, size.z + .12), material);
    ridge.name = ridgeName;
    ridge.position.set(center.x, bounds.max.y + .035, center.z);
    ridge.castShadow = true;
    ridge.receiveShadow = true;
    group.add(ridge);
  }

  collectInteriorColliders() {
    const group = this.groups[3];
    group.updateMatrixWorld(true);
    const colliders = [];
    const addBox = (object, padding=0) => {
      const bounds = new THREE.Box3().setFromObject(object);
      if (bounds.isEmpty()) return;
      const size = bounds.getSize(new THREE.Vector3());
      colliders.push({
        kind: "fortInterior",
        name: object.name,
        position: bounds.getCenter(new THREE.Vector3()),
        halfExtents: new THREE.Vector2(
          Math.max(.08, size.x / 2 + padding),
          Math.max(.08, size.z / 2 + padding),
        ),
      });
    };
    const addCircle = (object, radius) => colliders.push({
      kind: "fortInterior",
      name: object.name,
      position: object.getWorldPosition(new THREE.Vector3()),
      radius,
    });

    group.traverse((object) => {
      const name = object.name.replace(/\.\d+$/, "");
      if (/^(TowerBrace_|WorkshopBench$|WorkshopCrate$|StorehouseBody$|StorehouseCrate$|Stage3End_Scaffold(?:Platform|Brace))/.test(name)) {
        addBox(object, /StorehouseBody/.test(name) ? -.04 : -.02);
      } else if (/^TowerLeg_/.test(name)) addCircle(object, .34);
      else if (/^TowerLadder(?:Left|Right)$/.test(name)) addCircle(object, .15);
      else if (/^WorkshopPost_/.test(name)) addCircle(object, .27);
      else if (/^(WorkshopBarrel|StorehouseBarrel)$/.test(name)) addCircle(object, .53);
      else if (/^Stage3End_ScaffoldLeg_/.test(name)) addCircle(object, .22);
      else if (/^(?:GateTorch|InnerTorch).+_Pole$/.test(name)) addCircle(object, .14);
    });
    colliders.push({
      kind: "fortInterior",
      name: "Campfire",
      position: new THREE.Vector3(-.2, 0, .2),
      radius: .84,
    });
    return colliders;
  }

  resolveInteriorCollision(next, previous) {
    if (this.stage < 3) return;
    for (const collider of this.interiorColliders) {
      if (collider.halfExtents) {
        sweepAabb(
          previous, next, collider.position,
          collider.halfExtents.x + CONFIG.PLAYER.RADIUS,
          collider.halfExtents.y + CONFIG.PLAYER.RADIUS,
          next,
        );
      } else {
        sweepCircle(previous, next, collider.position, collider.radius + CONFIG.PLAYER.RADIUS, next);
      }
    }
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
      this.gateState = "open";
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
    this.resolveInteriorCollision(next, previous);
    const newRadius = Math.hypot(next.x, next.z);
    const oldRadius = Math.hypot(previous.x, previous.z);
    const crosses = (oldRadius < CONFIG.BUILD.WALL_INNER_RADIUS && newRadius >= CONFIG.BUILD.WALL_INNER_RADIUS)
      || (oldRadius > CONFIG.BUILD.WALL_OUTER_RADIUS && newRadius <= CONFIG.BUILD.WALL_OUTER_RADIUS);
    const insideWallBand = newRadius >= CONFIG.BUILD.WALL_INNER_RADIUS && newRadius <= CONFIG.BUILD.WALL_OUTER_RADIUS;
    if (!crosses && !insideWallBand) return;
    if (this.stage < 3) {
      // The fort assets were authored in Blender XY. glTF maps Blender +Y to
      // Three.js -Z, so convert the player angle back before comparing it to
      // the exact authored construction arc.
      const blenderAngle = Math.atan2(-next.z, next.x);
      const start = -Math.PI / 2 + .25;
      const span = Math.PI * 2 - .50;
      const delta = (blenderAngle - start + Math.PI * 2) % (Math.PI * 2);
      const fraction = this.stage === 1 ? .34 : .68;
      if (delta > span * fraction) return;
    }
    const throughGate = this.stage >= 2 && Math.abs(next.x) < 2.05 && next.z > 8.4 && (this.stage < 3 || this.gateOpen);
    if (!throughGate) next.copy(previous);
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
