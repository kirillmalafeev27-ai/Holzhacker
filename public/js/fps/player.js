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
    this.root.add(this.arms, this.log, this.stone);
    this.arms.position.set(0, -.46, -.78);
    this.arms.scale.setScalar(.92);
    this.buildHands();
    // The axe rides inside the arms group, anchored to the right fist, so the
    // handle stays in the palm during the swing and arm recoil.
    this.arms.add(this.axe);
    this.axe.position.copy(this.rightHandAnchor).add(new THREE.Vector3(.015, -.13, -.03));
    this.axe.rotation.set(.10, -.28, -.38);
    this.axe.scale.setScalar(.34 / .92);
    this.log.position.set(0, -.54, -1.18);
    this.log.rotation.set(0, 0, Math.PI / 2);
    this.log.scale.setScalar(.9);
    this.stone.position.copy(this.rightHandAnchor).multiplyScalar(.92).add(this.arms.position).add(new THREE.Vector3(0, .17, 0));
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

  buildHands() {
    const rightHandMesh = this.arms.getObjectByName("Arm_1_Hand");
    const leftHandMesh = this.arms.getObjectByName("Arm_-1_Hand");
    const skin = (rightHandMesh?.material && !Array.isArray(rightHandMesh.material))
      ? rightHandMesh.material
      : new THREE.MeshStandardMaterial({ color: 0x80592f, roughness: .85 });
    this.rightHandAnchor = rightHandMesh ? rightHandMesh.position.clone() : new THREE.Vector3(.24, -.30, -1.31);
    const leftAnchor = leftHandMesh ? leftHandMesh.position.clone() : new THREE.Vector3(-.24, -.30, -1.31);
    if (rightHandMesh) rightHandMesh.visible = false;
    if (leftHandMesh) leftHandMesh.visible = false;
    const right = this.makeHand(skin, 1, 1);
    right.position.copy(this.rightHandAnchor).add(new THREE.Vector3(0, .015, -.05));
    right.rotation.set(.10, -.28, -.38);
    const left = this.makeHand(skin, -1, .62);
    left.position.copy(leftAnchor).add(new THREE.Vector3(0, .015, -.05));
    left.rotation.set(.24, .30, .28);
    this.arms.add(right, left);
  }

  makeHand(material, side, curl) {
    // Chunky low-poly mitt sized to match the .28 m thick bracers.
    const hand = new THREE.Group();
    hand.name = side > 0 ? "HandRight" : "HandLeft";
    const palm = new THREE.Mesh(new THREE.BoxGeometry(.105, .235, .185), material);
    palm.position.set(side * -.085, -.008, .008);
    palm.rotation.y = side * .12;
    const knuckles = new THREE.Mesh(new THREE.BoxGeometry(.095, .205, .16), material);
    knuckles.position.set(side * -.024, .02, .02);
    hand.add(palm, knuckles);
    const rows = [.094, .033, -.028, -.089];
    for (let index = 0; index < rows.length; index += 1) {
      const reach = .092 - Math.abs(index - 1) * .008;
      this.addFingerArc(hand, material, side, rows[index], reach, 1.78, curl * (2.9 - index * .12));
    }
    // Thumb wraps the opposite way, lower on the grip.
    this.addFingerArc(hand, material, side, -.102, .094, -1.85, -curl * 1.55, .052);
    return hand;
  }

  addFingerArc(hand, material, side, y, radius, startAngle, wrap, thickness = .044) {
    const segments = 4;
    const segmentLength = Math.abs(wrap) * radius / segments + .016;
    for (let index = 0; index < segments; index += 1) {
      const angle = startAngle - wrap * (index + .5) / segments;
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(segmentLength, thickness, thickness), material);
      mesh.position.set(side * Math.cos(angle) * radius, y + index * .006, Math.sin(angle) * radius);
      mesh.rotation.y = side > 0 ? Math.atan2(-Math.cos(angle), -Math.sin(angle)) : Math.atan2(-Math.cos(angle), Math.sin(angle));
      hand.add(mesh);
    }
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
    // The terrain is a ±52 m square; keep the player on it with a small margin
    // so the whole location is walkable, corners included.
    next.x = THREE.MathUtils.clamp(next.x, -CONFIG.WORLD.BOUNDS, CONFIG.WORLD.BOUNDS);
    next.z = THREE.MathUtils.clamp(next.z, -CONFIG.WORLD.BOUNDS, CONFIG.WORLD.BOUNDS);
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
