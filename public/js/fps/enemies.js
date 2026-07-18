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
    this.activeMatch = 0;
    this.notesRemainingToDrop = CONFIG.NOTES.TOTAL;
    this.onDestroyed = () => {};
    this.spawnModels();
  }

  spawnModels() {
    const markers = ["CatapultSpawn_A", "CatapultSpawn_B", "CatapultSpawn_C"];
    const initialPositions = markers.map((name, index) => {
      const marker = this.assets.markerPosition(name) || new THREE.Vector3(25, 0, index * 5);
      return this.groundPosition(adjustedCatapultPosition(marker));
    });
    this.positionPool = catapultPositionPool(initialPositions).map((position) => this.groundPosition(position));
    const totalCatapults = CONFIG.CATAPULTS.COUNT * CONFIG.NOTES.MATCHES;
    for (let index = 0; index < totalCatapults; index += 1) {
      const position = this.positionPool[index].clone();
      const matchIndex = Math.floor(index / CONFIG.CATAPULTS.COUNT);
      const slot = index % CONFIG.CATAPULTS.COUNT;
      const intact = this.assets.clone("catapult");
      const destroyed = this.assets.clone("catapultDestroyed");
      intact.position.copy(position);
      destroyed.position.copy(position);
      intact.rotation.y = Math.atan2(-position.x, -position.z);
      destroyed.rotation.y = intact.rotation.y;
      intact.visible = matchIndex === 0;
      destroyed.visible = false;
      this.scene.add(intact, destroyed);
      let arm = null;
      intact.traverse((object) => { if (object.userData?.animatedPart === "throwingArm" || /ThrowingArm/.test(object.name)) arm = object; });
      this.catapults.push({
        id: index, slot, matchIndex, intact, destroyed, arm, position: position.clone(), anchor: position.clone(),
        travelDirection: position.clone().setY(0).normalize().multiplyScalar(-1),
        patrolTime: 0, patrolPhase: slot % 2 === 0 ? 0 : Math.PI,
        patrolRate: 1 + (slot - 1) * .08,
        health: CONFIG.CATAPULTS.HITS_TO_DESTROY, state: matchIndex === 0 ? "idle" : "waiting", timer: 1.8 + slot * 1.6,
        destroyedState: false, recoil: 0, smokeTimer: 0, smokeRemaining: 0,
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
    this.activateMatch(this.activeMatch);
  }

  activateMatch(matchIndex) {
    if (matchIndex < 0 || matchIndex >= CONFIG.NOTES.MATCHES) return false;
    this.activeMatch = matchIndex;
    for (const catapult of this.catapults) {
      if (catapult.matchIndex !== matchIndex || catapult.destroyedState) continue;
      catapult.state = "idle";
      catapult.timer = 1.8 + catapult.slot * 1.6;
      catapult.intact.visible = true;
      catapult.destroyed.visible = false;
    }
    return true;
  }

  isTargetable(catapult) {
    return Boolean(
      this.active
      && catapult
      && catapult.matchIndex === this.activeMatch
      && catapult.state !== "waiting"
      && !catapult.destroyedState
    );
  }

  collisionData() {
    const system = this;
    return this.catapults.map((catapult) => ({
      kind: "catapult",
      position: catapult.position,
      radius: CONFIG.CATAPULTS.COLLISION_RADIUS,
      get enabled() { return catapult.matchIndex === system.activeMatch && catapult.state !== "waiting"; },
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

  update(dt) {
    for (const catapult of this.catapults) {
      if (catapult.destroyedState) {
        catapult.smokeRemaining = Math.max(0, catapult.smokeRemaining - dt);
        catapult.smokeTimer -= dt;
        if (catapult.smokeRemaining > 0 && catapult.smokeTimer <= 0) {
          catapult.smokeTimer = .16;
          this.effects.smoke(catapult.position.clone().add(new THREE.Vector3(0, 1.2, 0)), 7);
        }
        continue;
      }
      if (!this.active || catapult.matchIndex !== this.activeMatch || catapult.state === "waiting") continue;
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
    if (!this.isTargetable(catapult)) return false;
    catapult.health -= 1;
    this.effects.catapultImpact(catapult.position.clone().add(new THREE.Vector3(0, .75, 0)));
    if (catapult.health <= 0) this.destroy(catapult);
    return true;
  }

  noteDropPosition(catapult) {
    const inward = catapult.position.clone().setY(0);
    if (inward.lengthSq() > 0) inward.normalize().multiplyScalar(-1);
    else inward.copy(catapult.travelDirection);
    const distance = CONFIG.CATAPULTS.COLLISION_RADIUS
      + CONFIG.PLAYER.RADIUS
      + CONFIG.CATAPULTS.NOTE_DROP_CLEARANCE;
    return this.groundPosition(catapult.position.clone().addScaledVector(inward, distance));
  }

  destroy(catapult) {
    if (catapult.destroyedState) return false;
    catapult.destroyedState = true;
    catapult.intact.visible = false;
    catapult.destroyed.visible = true;
    catapult.smokeTimer = 0;
    catapult.smokeRemaining = 4;
    this.effects.constructionBurst(catapult.position.clone(), 30);
    const notesDropped = Math.min(CONFIG.CATAPULTS.NOTES_PER_DESTRUCTION, this.notesRemainingToDrop);
    let noteTarget = null;
    if (notesDropped > 0) {
      const dropped = this.notes.drop(this.noteDropPosition(catapult), notesDropped);
      noteTarget = dropped[0]?.object?.position?.clone?.() || null;
      this.notesRemainingToDrop -= notesDropped;
    }
    this.onDestroyed(catapult.slot, notesDropped, noteTarget, catapult.matchIndex);
    return true;
  }

  stop() {
    this.active = false;
  }
}
