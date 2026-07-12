import * as THREE from "three";
import { CONFIG } from "./config.js";


const UP = new THREE.Vector3(0, 1, 0);

export class FirstPersonRig {
  constructor(camera, assets) {
    this.camera = camera;
    this.root = new THREE.Group();
    this.root.name = "FirstPersonRig";
    camera.add(this.root);
    this.arms = assets.clone("arms");
    this.axe = assets.clone("axe");
    this.log = assets.clone("log");
    this.stone = assets.clone("stone");
    this.root.add(this.arms, this.axe, this.log, this.stone);
    this.arms.position.set(0, -.46, -.78);
    this.arms.scale.setScalar(.92);
    this.axe.position.set(.46, -.60, -1.02);
    this.axe.rotation.set(.10, -.28, -.38);
    this.axe.scale.setScalar(.34);
    this.log.position.set(0, -.54, -1.18);
    this.log.rotation.set(0, 0, Math.PI / 2);
    this.log.scale.setScalar(.9);
    this.stone.position.set(.32, -.36, -.74);
    this.stone.scale.setScalar(1.1);
    this.log.visible = false;
    this.stone.visible = false;
    this.mode = "axe";
    this.time = 0;
    this.swing = null;
    this.recoil = 0;
    this.interactionPulse = 0;
    this.root.traverse((object) => {
      if (object.isMesh) {
        object.renderOrder = 100;
        if (Array.isArray(object.material)) {
          object.material = object.material.map((material) => {
            const clone = material.clone();
            clone.depthTest = false;
            return clone;
          });
        } else {
          object.material = object.material.clone();
          object.material.depthTest = false;
        }
        object.frustumCulled = false;
        object.castShadow = false;
      }
    });
  }

  setMode(mode) {
    this.mode = mode;
    this.axe.visible = mode === "axe";
    this.log.visible = mode === "log";
    this.stone.visible = mode === "stone";
  }

  startSwing(onImpact) {
    if (this.swing) return false;
    this.swing = { time: 0, impacted: false, onImpact };
    return true;
  }

  damageReaction() {
    this.recoil = 1;
  }

  pickupReaction() {
    this.interactionPulse = 1;
  }

  update(dt, moving, running) {
    this.time += dt * (moving ? (running ? 10 : 7) : 2.2);
    const bob = moving ? Math.sin(this.time) * .015 : Math.sin(this.time) * .004;
    const sway = moving ? Math.cos(this.time * .5) * .012 : 0;
    this.root.position.set(sway, bob, 0);
    this.root.rotation.z = sway * .8;
    if (this.recoil > 0) {
      this.recoil = Math.max(0, this.recoil - dt * 3.5);
      this.root.position.z += Math.sin((1 - this.recoil) * Math.PI) * .16;
      this.root.rotation.x = -.18 * this.recoil;
    } else {
      this.root.rotation.x = 0;
    }
    if (this.interactionPulse > 0) {
      this.interactionPulse = Math.max(0, this.interactionPulse - dt * 2.8);
      this.root.position.z -= Math.sin((1 - this.interactionPulse) * Math.PI) * .22;
    }
    if (!this.swing) return;
    this.swing.time += dt;
    const t = Math.min(1, this.swing.time / CONFIG.CHOP.SWING_DURATION);
    const windup = t < .32 ? t / .32 : 1 - (t - .32) / .68;
    const strike = Math.sin(Math.min(1, t / .72) * Math.PI);
    this.axe.rotation.x = .10 - strike * 1.12;
    this.axe.rotation.z = -.38 + windup * .48;
    this.arms.rotation.x = -strike * .22;
    if (!this.swing.impacted && this.swing.time >= CONFIG.CHOP.IMPACT_TIME) {
      this.swing.impacted = true;
      this.swing.onImpact?.();
    }
    if (t >= 1) {
      this.swing = null;
      this.axe.rotation.set(.10, -.28, -.38);
      this.arms.rotation.set(0, 0, 0);
    }
  }
}


export class FirstPersonController {
  constructor(camera, input, assets) {
    this.camera = camera;
    this.input = input;
    this.rig = new FirstPersonRig(camera, assets);
    this.velocity = new THREE.Vector3();
    this.direction = new THREE.Vector3();
    this.position = new THREE.Vector3();
    this.yaw = 0;
    this.pitch = 0;
    this.health = CONFIG.PLAYER.MAX_HEALTH;
    this.invulnerability = 0;
    this.dodgeTimer = 0;
    this.carrying = false;
    this.movementLocked = false;
    this.onDamage = () => {};
    this.onDeath = () => {};
    this.terrainMeshes = [];
    this.colliders = [];
    this.fortCollision = null;
    this.raycaster = new THREE.Raycaster();
    this.lookScratch = new THREE.Vector2();
    camera.rotation.order = "YXZ";
  }

  spawn(position) {
    this.position.copy(position);
    this.camera.position.copy(position);
    this.camera.near = .06;
    this.camera.updateProjectionMatrix();
  }

  setEnvironment(terrainMeshes, colliders, fortCollision) {
    this.terrainMeshes = terrainMeshes;
    this.colliders = colliders;
    this.fortCollision = fortCollision;
  }

  setCarrying(value) {
    this.carrying = value;
    this.rig.setMode(value ? "log" : "axe");
  }

  setStoneMode(value) {
    this.rig.setMode(value ? "stone" : "axe");
  }

  damage(amount = 1) {
    if (this.invulnerability > 0 || this.health <= 0) return false;
    this.health = Math.max(0, this.health - amount);
    this.invulnerability = CONFIG.PLAYER.INVULNERABILITY;
    this.rig.damageReaction();
    this.onDamage(this.health);
    if (this.health <= 0) this.onDeath();
    return true;
  }

  update(dt, paused = false) {
    this.invulnerability = Math.max(0, this.invulnerability - dt);
    const look = this.input.consumeLook(this.lookScratch);
    if (!paused) {
      this.yaw -= look.x * .00205;
      this.pitch -= look.y * .00185;
      this.pitch = THREE.MathUtils.clamp(this.pitch, -1.35, 1.35);
      this.camera.rotation.set(this.pitch, this.yaw, 0);
    }
    if (paused || this.movementLocked) {
      this.rig.update(dt, false, false);
      return;
    }
    let x = 0, z = 0;
    if (this.input.held("KeyW")) z -= 1;
    if (this.input.held("KeyS")) z += 1;
    if (this.input.held("KeyA")) x -= 1;
    if (this.input.held("KeyD")) x += 1;
    const moving = x !== 0 || z !== 0;
    const running = this.input.held("ShiftLeft") || this.input.held("ShiftRight");
    if (this.input.consume("Space") && !this.carrying && this.dodgeTimer <= 0) {
      this.dodgeTimer = CONFIG.PLAYER.DODGE_TIME;
      this.invulnerability = Math.max(this.invulnerability, .42);
    }
    this.dodgeTimer = Math.max(0, this.dodgeTimer - dt);
    let speed = this.carrying ? CONFIG.PLAYER.CARRY_SPEED : running ? CONFIG.PLAYER.RUN_SPEED : CONFIG.PLAYER.WALK_SPEED;
    if (this.dodgeTimer > 0) speed = CONFIG.PLAYER.DODGE_SPEED;
    this.direction.set(x, 0, z).normalize().applyAxisAngle(UP, this.yaw);
    if (this.dodgeTimer > 0 && !moving) this.direction.set(0, 0, -1).applyAxisAngle(UP, this.yaw);
    const next = this.position.clone().addScaledVector(this.direction, speed * dt);
    this.resolveWorldBounds(next);
    this.resolveStream(next);
    this.resolveColliders(next);
    this.fortCollision?.(next, this.position);
    const ground = this.groundHeight(next.x, next.z);
    if (ground !== null) next.y = THREE.MathUtils.damp(this.position.y, ground + CONFIG.PLAYER.EYE_HEIGHT, 18, dt);
    this.position.copy(next);
    this.camera.position.copy(this.position);
    this.rig.update(dt, moving || this.dodgeTimer > 0, running);
  }

  resolveWorldBounds(next) {
    const radius = Math.hypot(next.x, next.z);
    if (radius > CONFIG.WORLD.RADIUS) {
      next.x *= CONFIG.WORLD.RADIUS / radius;
      next.z *= CONFIG.WORLD.RADIUS / radius;
    }
  }

  resolveStream(next) {
    const blenderY = -next.z;
    const center = -28.2 + Math.sin(blenderY * .085) * 2.3 + blenderY * .035;
    const onBridge = Math.abs(next.z - CONFIG.WORLD.BRIDGE_Z) < 2.25;
    if (!onBridge && Math.abs(next.x - center) < CONFIG.WORLD.STREAM_BLOCK_HALF_WIDTH + CONFIG.PLAYER.RADIUS) {
      next.copy(this.position);
    }
  }

  resolveColliders(next) {
    for (const collider of this.colliders) {
      const dx = next.x - collider.position.x;
      const dz = next.z - collider.position.z;
      const minimum = collider.radius + CONFIG.PLAYER.RADIUS;
      const length = Math.hypot(dx, dz);
      if (length > 0 && length < minimum) {
        next.x = collider.position.x + dx / length * minimum;
        next.z = collider.position.z + dz / length * minimum;
      }
    }
  }

  groundHeight(x, z) {
    this.raycaster.set(new THREE.Vector3(x, 30, z), new THREE.Vector3(0, -1, 0));
    const hits = this.raycaster.intersectObjects(this.terrainMeshes, false);
    return hits.length ? hits[0].point.y : null;
  }
}
