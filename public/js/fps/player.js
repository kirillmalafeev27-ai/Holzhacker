import * as THREE from "three";
import { CONFIG } from "./config.js";
import { lookAnglesToTarget } from "./guidance.js";


const UP = new THREE.Vector3(0, 1, 0);

export function sweepCircle(start, end, center, radius, target=end) {
  const dx = end.x - start.x;
  const dz = end.z - start.z;
  const fx = start.x - center.x;
  const fz = start.z - center.z;
  const startDistance = Math.hypot(fx, fz);
  if (startDistance < radius) {
    const nx = startDistance > 1e-5 ? fx / startDistance : (Math.abs(dx) > 1e-5 ? -Math.sign(dx) : 1);
    const nz = startDistance > 1e-5 ? fz / startDistance : (Math.abs(dz) > 1e-5 ? -Math.sign(dz) : 0);
    target.x = center.x + nx * radius;
    target.z = center.z + nz * radius;
    return true;
  }
  const a = dx * dx + dz * dz;
  if (a < 1e-9) return false;
  const b = 2 * (fx * dx + fz * dz);
  const c = fx * fx + fz * fz - radius * radius;
  const discriminant = b * b - 4 * a * c;
  if (discriminant < 0) return false;
  const root = Math.sqrt(discriminant);
  const t = (-b - root) / (2 * a);
  if (t < 0 || t > 1) return false;
  const length = Math.sqrt(a);
  target.x = start.x + dx * t - dx / length * .025;
  target.z = start.z + dz * t - dz / length * .025;
  return true;
}

export function sweepAabb(start, end, center, halfX, halfZ, target=end) {
  const sx = start.x - center.x;
  const sz = start.z - center.z;
  const ex = end.x - center.x;
  const ez = end.z - center.z;
  const startsInside = Math.abs(sx) < halfX && Math.abs(sz) < halfZ;
  if (startsInside) {
    // Never trap a player who was already inside while a construction stage
    // appeared: a movement that exits the box remains legal.
    if (Math.abs(ex) >= halfX || Math.abs(ez) >= halfZ) return false;
    const xGap = halfX - Math.abs(sx);
    const zGap = halfZ - Math.abs(sz);
    if (xGap < zGap) {
      target.x = center.x + (sx >= 0 ? halfX : -halfX);
      target.z = start.z;
    } else {
      target.x = start.x;
      target.z = center.z + (sz >= 0 ? halfZ : -halfZ);
    }
    return true;
  }

  const dx = end.x - start.x;
  const dz = end.z - start.z;
  let enter = 0;
  let exit = 1;
  for (const [origin, delta, half] of [[sx, dx, halfX], [sz, dz, halfZ]]) {
    if (Math.abs(delta) < 1e-9) {
      if (origin < -half || origin > half) return false;
      continue;
    }
    let near = (-half - origin) / delta;
    let far = (half - origin) / delta;
    if (near > far) [near, far] = [far, near];
    enter = Math.max(enter, near);
    exit = Math.min(exit, far);
    if (enter > exit) return false;
  }
  if (enter < 0 || enter > 1) return false;
  const length = Math.hypot(dx, dz);
  const stop = Math.max(0, enter - (length > 1e-6 ? .025 / length : 0));
  target.x = start.x + dx * stop;
  target.z = start.z + dz * stop;
  return true;
}

export class FirstPersonRig {
  constructor(camera, assets) {
    this.camera = camera;
    this.root = new THREE.Group();
    this.root.name = "FirstPersonRig";
    camera.add(this.root);
    this.poseRoot = new THREE.Group();
    this.poseRoot.name = "FirstPersonPoseRoot";
    this.root.add(this.poseRoot);
    this.views = {
      axe: assets.clone("viewAxe"),
      log: assets.clone("viewLog"),
      stone: assets.clone("viewStone"),
    };
    this.axe = this.views.axe;
    this.log = this.views.log;
    this.stone = this.views.stone;
    for (const [mode, view] of Object.entries(this.views)) {
      view.name = `FirstPerson${mode[0].toUpperCase()}${mode.slice(1)}View`;
      this.poseRoot.add(view);
    }
    this.mode = "axe";
    this.time = 0;
    this.swing = null;
    this.recoil = 0;
    this.interactionPulse = 0;
    this.root.traverse((object) => {
      object.layers.set(1);
      if (object.isMesh) {
        object.renderOrder = 0;
        if (Array.isArray(object.material)) {
          object.material = object.material.map((material) => {
            const clone = material.clone();
            clone.depthTest = true;
            clone.depthWrite = true;
            return clone;
          });
        } else {
          object.material = object.material.clone();
          object.material.depthTest = true;
          object.material.depthWrite = true;
        }
        object.frustumCulled = false;
        object.castShadow = false;
      }
    });
    this.setMode("axe");
  }

  setMode(mode) {
    if (!this.views[mode]) return false;
    this.mode = mode;
    for (const [key, view] of Object.entries(this.views)) view.visible = key === mode;
    this.poseRoot.rotation.set(0, 0, 0);
    return true;
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
    this.poseRoot.rotation.x = -strike * .78;
    this.poseRoot.rotation.y = strike * .12;
    this.poseRoot.rotation.z = windup * .18;
    if (!this.swing.impacted && this.swing.time >= CONFIG.CHOP.IMPACT_TIME) {
      this.swing.impacted = true;
      this.swing.onImpact?.();
    }
    if (t >= 1) {
      this.swing = null;
      this.poseRoot.rotation.set(0, 0, 0);
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

  forceLookAt(target, dt) {
    const desired = lookAnglesToTarget(this.position, target);
    const yawDelta = Math.atan2(Math.sin(desired.yaw - this.yaw), Math.cos(desired.yaw - this.yaw));
    const blend = 1 - Math.exp(-9 * dt);
    this.yaw += yawDelta * blend;
    this.pitch = THREE.MathUtils.clamp(
      THREE.MathUtils.lerp(this.pitch, desired.pitch, blend),
      -1.35,
      1.35,
    );
    this.camera.rotation.set(this.pitch, this.yaw, 0);
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
    next.x = THREE.MathUtils.clamp(next.x, -CONFIG.WORLD.HALF_SIZE, CONFIG.WORLD.HALF_SIZE);
    next.z = THREE.MathUtils.clamp(next.z, -CONFIG.WORLD.HALF_SIZE, CONFIG.WORLD.HALF_SIZE);
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
      if (collider.enabled === false || (collider.ref && collider.ref.state !== "standing")) continue;
      if (collider.halfExtents) {
        sweepAabb(
          this.position, next, collider.position,
          collider.halfExtents.x + CONFIG.PLAYER.RADIUS,
          collider.halfExtents.y + CONFIG.PLAYER.RADIUS,
          next,
        );
      } else {
        const minimum = collider.radius + CONFIG.PLAYER.RADIUS;
        sweepCircle(this.position, next, collider.position, minimum, next);
      }
    }
  }

  groundHeight(x, z) {
    this.raycaster.set(new THREE.Vector3(x, 30, z), new THREE.Vector3(0, -1, 0));
    const hits = this.raycaster.intersectObjects(this.terrainMeshes, false);
    return hits.length ? hits[0].point.y : null;
  }
}
