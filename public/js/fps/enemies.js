import * as THREE from "three";
import { CONFIG } from "./config.js";
import { adjustedCatapultPosition, catapultPositionPool } from "./world-layout.js";


export class GoblinSystem {
  constructor(scene, assets, navigation, fort, effects, audio) {
    this.scene = scene;
    this.assets = assets;
    this.navigation = navigation;
    this.fort = fort;
    this.effects = effects;
    this.audio = audio;
    this.agents = [];
    this.active = false;
    this.onBaseAttack = () => {};
  }

  spawn() {
    if (this.active) return;
    this.active = true;
    const markerNames = ["GoblinSpawn_A", "GoblinSpawn_B", "GoblinSpawn_C"];
    for (let index = 0; index < CONFIG.GOBLINS.COUNT; index += 1) {
      const marker = this.assets.markerPosition(markerNames[index % markerNames.length]) || new THREE.Vector3(35, 0, 0);
      const angle = index * 2.399;
      const position = this.navigation.nearestPoint(marker.clone().add(new THREE.Vector3(Math.cos(angle) * (1 + index * .28), 0, Math.sin(angle) * (1 + index * .28))));
      const object = this.assets.clone("goblin");
      object.position.copy(position);
      object.scale.setScalar(.86 + (index % 3) * .05);
      object.traverse((mesh) => { if (mesh.isMesh) { mesh.castShadow = true; mesh.receiveShadow = true; } });
      this.scene.add(object);
      this.agents.push({
        id: index, object, state: "spawn", path: [], pathIndex: 0,
        targetPoint: null, repathTimer: index * .12, stuckTimer: 0,
        lastPosition: position.clone(), attackTimer: .4 + index * .16,
        phase: index * .7, velocity: new THREE.Vector3(), defeated: false,
        bobOffset: 0,
        navNode: this.navigation.closestNode(position),
      });
    }
    this.repathAll();
  }

  repathAll() {
    for (const agent of this.agents) {
      if (agent.defeated) continue;
      agent.state = "selectTarget";
      agent.repathTimer = 0;
    }
  }

  requestPath(agent) {
    agent.targetPoint = this.navigation.chooseAttackPoint(agent.object.position, this.agents);
    if (!agent.targetPoint) return;
    const target = this.navigation.nearestPoint(agent.targetPoint.position);
    agent.path = this.navigation.findPath(agent.object.position, target);
    agent.pathIndex = 0;
    agent.repathTimer = CONFIG.GOBLINS.REPATH_INTERVAL * (.75 + Math.random() * .5);
    agent.state = agent.path.length ? "moveAlongPath" : "requestPath";
  }

  separation(agent) {
    const force = new THREE.Vector3();
    for (const other of this.agents) {
      if (other === agent || other.defeated) continue;
      const delta = agent.object.position.clone().sub(other.object.position);
      delta.y = 0;
      const distance = delta.length();
      if (distance <= 0 || distance >= CONFIG.GOBLINS.SEPARATION_RADIUS) continue;
      force.add(delta.normalize().multiplyScalar((CONFIG.GOBLINS.SEPARATION_RADIUS - distance) / CONFIG.GOBLINS.SEPARATION_RADIUS));
    }
    return force.multiplyScalar(CONFIG.GOBLINS.SEPARATION_FORCE);
  }

  update(dt) {
    if (!this.active || this.fort.health <= 0) return;
    for (const agent of this.agents) {
      if (agent.defeated) continue;
      agent.phase += dt * 7;
      agent.repathTimer -= dt;
      if (agent.state === "spawn" || agent.state === "selectTarget" || agent.state === "requestPath") this.requestPath(agent);
      if (agent.state === "moveAlongPath") this.moveAgent(agent, dt);
      if (agent.state === "attackWall") this.attackWall(agent, dt);
      this.animateAgent(agent, dt);
    }
    if (this.navigation.debugVisible && this.agents.length) {
      const selected = this.agents.find((agent) => !agent.defeated);
      if (selected) this.navigation.showPath([selected.object.position, ...selected.path.slice(selected.pathIndex)]);
    }
  }

  moveAgent(agent, dt) {
    const waypoint = agent.path[agent.pathIndex];
    if (!waypoint) {
      const distanceToWall = agent.targetPoint ? agent.object.position.distanceTo(agent.targetPoint.position) : Infinity;
      agent.state = distanceToWall < 2.1 ? "attackWall" : "requestPath";
      return;
    }
    const direction = waypoint.clone().sub(agent.object.position);
    direction.y = 0;
    const distance = direction.length();
    if (distance < .38) {
      agent.pathIndex += 1;
      return;
    }
    direction.normalize();
    const avoidance = this.separation(agent);
    agent.velocity.copy(direction).multiplyScalar(CONFIG.GOBLINS.SPEED).add(avoidance);
    const candidate = agent.object.position.clone().addScaledVector(agent.velocity, dt);
    const clamped = this.navigation.clampStep(agent.object.position, candidate, agent.navNode);
    agent.navNode = clamped.node;
    agent.object.position.copy(clamped.position);
    agent.object.position.y = THREE.MathUtils.damp(agent.object.position.y, waypoint.y, 10, dt);
    agent.object.rotation.y = Math.atan2(agent.velocity.x, agent.velocity.z);

    const moved = agent.object.position.distanceTo(agent.lastPosition);
    if (moved < .035) agent.stuckTimer += dt;
    else {
      agent.stuckTimer = 0;
      agent.lastPosition.copy(agent.object.position);
    }
    if (agent.stuckTimer > CONFIG.GOBLINS.STUCK_TIME || agent.repathTimer <= 0) {
      agent.stuckTimer = 0;
      agent.state = "requestPath";
    }
  }

  attackWall(agent, dt) {
    agent.attackTimer -= dt;
    if (agent.attackTimer > 0) return;
    agent.attackTimer = CONFIG.GOBLINS.ATTACK_INTERVAL * (.86 + Math.random() * .3);
    this.fort.damage(CONFIG.GOBLINS.ATTACK_DAMAGE);
    this.effects.woodBurst(agent.targetPoint.position.clone().add(new THREE.Vector3(0, 1.2, 0)));
    this.onBaseAttack(agent);
  }

  animateAgent(agent) {
    const bob = Math.sin(agent.phase) * .022;
    agent.object.position.y += bob - agent.bobOffset;
    agent.bobOffset = bob;
    agent.object.traverse((part) => {
      if (/GoblinArm/.test(part.name)) part.rotation.x = Math.sin(agent.phase) * .35;
      if (/GoblinLeg/.test(part.name)) part.rotation.x = Math.sin(agent.phase + (part.name.includes("-1") ? Math.PI : 0)) * .28;
    });
  }

  stop() {
    this.active = false;
    for (const agent of this.agents) agent.velocity.set(0, 0, 0);
  }
}


export class CatapultSystem {
  constructor(scene, assets, projectiles, fort, player, notes, effects, audio) {
    this.scene = scene;
    this.assets = assets;
    this.projectiles = projectiles;
    this.fort = fort;
    this.player = player;
    this.notes = notes;
    this.effects = effects;
    this.audio = audio;
    this.catapults = [];
    this.active = false;
    this.notesRemainingToDrop = CONFIG.NOTES.TOTAL;
    this.nextPositionIndex = CONFIG.CATAPULTS.COUNT;
    this.onDestroyed = () => {};
    this.onReinforced = () => {};
    this.spawnModels();
  }

  spawnModels() {
    const markers = ["CatapultSpawn_A", "CatapultSpawn_B", "CatapultSpawn_C"];
    const initialPositions = markers.map((name, index) => {
      const marker = this.assets.markerPosition(name) || new THREE.Vector3(25, 0, index * 5);
      return this.groundPosition(adjustedCatapultPosition(marker));
    });
    this.positionPool = catapultPositionPool(initialPositions).map((position) => this.groundPosition(position));
    for (let index = 0; index < CONFIG.CATAPULTS.COUNT; index += 1) {
      const position = this.positionPool[index].clone();
      const intact = this.assets.clone("catapult");
      const destroyed = this.assets.clone("catapultDestroyed");
      intact.position.copy(position);
      destroyed.position.copy(position);
      intact.rotation.y = Math.atan2(-position.x, -position.z);
      destroyed.rotation.y = intact.rotation.y;
      destroyed.visible = false;
      this.scene.add(intact, destroyed);
      let arm = null;
      intact.traverse((object) => { if (object.userData?.animatedPart === "throwingArm" || /ThrowingArm/.test(object.name)) arm = object; });
      this.catapults.push({
        id: index, intact, destroyed, arm, position: position.clone(), anchor: position.clone(),
        travelDirection: position.clone().setY(0).normalize().multiplyScalar(-1),
        patrolTime: 0, patrolPhase: index % 2 === 0 ? 0 : Math.PI,
        patrolRate: 1 + (index - 1) * .08,
        health: CONFIG.CATAPULTS.HITS_TO_DESTROY, state: "idle", timer: 1.8 + index * 1.6,
        destroyedState: false, recoil: 0, smokeTimer: 0, respawnTimer: 0,
        arrivalProgress: 0, arrivalStart: position.clone(), generation: 0,
      });
    }
  }

  groundPosition(position) {
    const grounded = position.clone();
    const ground = this.player.groundHeight?.(grounded.x, grounded.z);
    if (ground !== null && ground !== undefined) grounded.y = ground;
    return grounded;
  }

  activate() {
    this.active = true;
  }

  collisionData() {
    return this.catapults.map((catapult) => ({
      kind: "catapult",
      position: catapult.position,
      radius: CONFIG.CATAPULTS.COLLISION_RADIUS,
    }));
  }

  updatePatrol(catapult, dt) {
    catapult.patrolTime += dt;
    const offset = Math.sin(
      catapult.patrolTime * CONFIG.CATAPULTS.PATROL_ANGULAR_SPEED * catapult.patrolRate + catapult.patrolPhase,
    ) * CONFIG.CATAPULTS.PATROL_DISTANCE;
    catapult.position.copy(catapult.anchor).addScaledVector(catapult.travelDirection, offset);
    catapult.intact.position.copy(catapult.position);
    catapult.destroyed.position.copy(catapult.position);
  }

  nextReinforcementAnchor(catapult) {
    for (let attempt = 0; attempt < this.positionPool.length * 2; attempt += 1) {
      const candidate = this.positionPool[this.nextPositionIndex % this.positionPool.length].clone();
      this.nextPositionIndex += 1;
      if (candidate.distanceTo(catapult.anchor) < 1) continue;
      const occupied = this.catapults.some((other) => other !== catapult && candidate.distanceTo(other.anchor) < 5);
      if (!occupied) return this.groundPosition(candidate);
    }
    const angle = Math.atan2(catapult.anchor.z, catapult.anchor.x) + CONFIG.CATAPULTS.REINFORCEMENT_ANGLE_OFFSET;
    const radius = Math.hypot(catapult.anchor.x, catapult.anchor.z) + CONFIG.CATAPULTS.REINFORCEMENT_RADIAL_OFFSET;
    return this.groundPosition(new THREE.Vector3(Math.cos(angle) * radius, catapult.anchor.y, Math.sin(angle) * radius));
  }

  startReinforcement(catapult) {
    const nextAnchor = this.nextReinforcementAnchor(catapult);
    catapult.anchor.copy(nextAnchor);
    catapult.travelDirection.copy(nextAnchor).setY(0).normalize().multiplyScalar(-1);
    catapult.arrivalStart.copy(nextAnchor).addScaledVector(
      catapult.travelDirection,
      -CONFIG.CATAPULTS.REINFORCEMENT_ARRIVAL_DISTANCE,
    );
    catapult.position.copy(catapult.arrivalStart);
    catapult.arrivalProgress = 0;
    catapult.patrolTime = 0;
    catapult.patrolPhase = catapult.id % 2 === 0 ? 0 : Math.PI;
    catapult.health = CONFIG.CATAPULTS.HITS_TO_DESTROY;
    catapult.state = "reinforcing";
    catapult.destroyedState = false;
    catapult.generation += 1;
    catapult.recoil = 0;
    catapult.timer = 2.2 + catapult.id * .7;
    const facing = Math.atan2(-nextAnchor.x, -nextAnchor.z);
    catapult.intact.rotation.y = facing;
    catapult.destroyed.rotation.y = facing;
    catapult.intact.position.copy(catapult.position);
    catapult.destroyed.position.copy(catapult.position);
    catapult.intact.visible = true;
    catapult.destroyed.visible = false;
    if (catapult.arm) catapult.arm.rotation.x = 0;
  }

  updateReinforcement(catapult, dt) {
    catapult.arrivalProgress = Math.min(
      1,
      catapult.arrivalProgress + dt / CONFIG.CATAPULTS.REINFORCEMENT_ARRIVAL_DURATION,
    );
    const t = catapult.arrivalProgress;
    const eased = t * t * (3 - 2 * t);
    catapult.position.lerpVectors(catapult.arrivalStart, catapult.anchor, eased);
    catapult.intact.position.copy(catapult.position);
    catapult.destroyed.position.copy(catapult.position);
    if (t < 1) return;
    catapult.state = "idle";
    this.onReinforced(catapult.id, catapult.generation, catapult.anchor.clone());
  }

  update(dt) {
    for (const catapult of this.catapults) {
      if (catapult.destroyedState) {
        catapult.smokeTimer -= dt;
        if (catapult.smokeTimer <= 0) {
          catapult.smokeTimer = .16;
          this.effects.smoke(catapult.position.clone().add(new THREE.Vector3(0, 1.2, 0)), 7);
        }
        if (this.active) {
          catapult.respawnTimer -= dt;
          if (catapult.respawnTimer <= 0) this.startReinforcement(catapult);
        }
        continue;
      }
      if (catapult.state === "reinforcing") {
        this.updateReinforcement(catapult, dt);
        continue;
      }
      if (!this.active) continue;
      this.updatePatrol(catapult, dt);
      catapult.timer -= dt;
      if (catapult.state === "idle" && catapult.timer <= .85) catapult.state = "prepare";
      if (catapult.state === "prepare" && catapult.arm) catapult.arm.rotation.x = THREE.MathUtils.damp(catapult.arm.rotation.x, .42, 4.5, dt);
      if (catapult.timer <= 0) this.fire(catapult);
      if (catapult.recoil > 0) {
        catapult.recoil = Math.max(0, catapult.recoil - dt * 1.9);
        if (catapult.arm) catapult.arm.rotation.x = -1.05 * Math.sin(catapult.recoil * Math.PI);
      }
    }
  }

  fire(catapult) {
    catapult.state = "recoil";
    catapult.recoil = 1;
    catapult.timer = CONFIG.CATAPULTS.MIN_FIRE_INTERVAL + Math.random() * (CONFIG.CATAPULTS.MAX_FIRE_INTERVAL - CONFIG.CATAPULTS.MIN_FIRE_INTERVAL);
    this.audio.play("catapult");
    const playerOutside = Math.hypot(this.player.position.x, this.player.position.z) > CONFIG.BUILD.FORT_RADIUS + 1;
    const aimPlayer = playerOutside && Math.random() < .52;
    const wallAngle = Math.random() * Math.PI * 2;
    const wallRadius = (CONFIG.BUILD.WALL_INNER_RADIUS + CONFIG.BUILD.WALL_OUTER_RADIUS) * .5 + (Math.random() - .5) * .45;
    const target = aimPlayer
      ? this.player.position.clone().add(new THREE.Vector3(this.player.velocity.x * .35, -CONFIG.PLAYER.EYE_HEIGHT + .1, this.player.velocity.z * .35))
      : new THREE.Vector3(Math.cos(wallAngle) * wallRadius, .85 + Math.random() * 1.8, Math.sin(wallAngle) * wallRadius);
    const start = catapult.position.clone().add(new THREE.Vector3(0, 3.2, 0));
    this.projectiles.launch({
      kind: aimPlayer ? "enemy-player" : "enemy-base",
      start, target, scale: 1.35, warning: true,
      onImpact: (position, kind) => {
        if (kind === "enemy-player") this.effects.dirtImpact(position);
        else this.effects.fortImpact(position);
        this.audio.play("impact");
        if (kind === "enemy-player") {
          if (this.player.position.distanceTo(position.clone().add(new THREE.Vector3(0, CONFIG.PLAYER.EYE_HEIGHT, 0))) < 1.8) this.player.damage(1);
        } else {
          this.fort.damage(CONFIG.CATAPULTS.BASE_DAMAGE);
        }
      },
    });
  }

  hit(index) {
    const catapult = this.catapults[index];
    if (!catapult || catapult.destroyedState) return false;
    catapult.health -= 1;
    this.effects.catapultImpact(catapult.position.clone().add(new THREE.Vector3(0, .75, 0)));
    if (catapult.health <= 0) this.destroy(catapult);
    return true;
  }

  destroy(catapult) {
    if (catapult.destroyedState) return false;
    catapult.destroyedState = true;
    catapult.intact.visible = false;
    catapult.destroyed.visible = true;
    catapult.smokeTimer = 0;
    catapult.respawnTimer = CONFIG.CATAPULTS.REINFORCEMENT_DELAY
      + catapult.id * CONFIG.CATAPULTS.REINFORCEMENT_STAGGER;
    this.effects.constructionBurst(catapult.position.clone(), 30);
    const notesDropped = Math.min(CONFIG.CATAPULTS.NOTES_PER_DESTRUCTION, this.notesRemainingToDrop);
    if (notesDropped > 0) {
      this.notes.drop(catapult.position, notesDropped);
      this.notesRemainingToDrop -= notesDropped;
    }
    this.onDestroyed(catapult.id, notesDropped, catapult.respawnTimer);
    return true;
  }

  stop() {
    this.active = false;
  }
}
