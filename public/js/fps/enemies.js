import * as THREE from "three";
import { CONFIG } from "./config.js";


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
  // How far each catapult is pulled toward the fort from its authored marker.
  // Spawn A sits just west of the stream, so it is pulled less to stay out of
  // the water trench.
  static PULL = { CatapultSpawn_A: .9, CatapultSpawn_B: .8, CatapultSpawn_C: .8 };

  static plannedPositions(assets) {
    const markers = ["CatapultSpawn_A", "CatapultSpawn_B", "CatapultSpawn_C"];
    return markers.slice(0, CONFIG.CATAPULTS.COUNT).map((name, index) => {
      const position = assets.markerPosition(name) || new THREE.Vector3(25, 0, index * 5);
      const pull = CatapultSystem.PULL[name] ?? .85;
      position.x *= pull;
      position.z *= pull;
      return position;
    });
  }

  constructor(scene, assets, projectiles, fort, player, notes, effects, audio, groundHeight = null) {
    this.scene = scene;
    this.assets = assets;
    this.projectiles = projectiles;
    this.fort = fort;
    this.player = player;
    this.notes = notes;
    this.effects = effects;
    this.audio = audio;
    this.groundHeight = groundHeight;
    this.catapults = [];
    this.active = false;
    this.onDestroyed = () => {};
    this.spawnModels();
  }

  spawnModels() {
    const positions = CatapultSystem.plannedPositions(this.assets);
    for (let index = 0; index < positions.length; index += 1) {
      const position = positions[index];
      const ground = this.groundHeight?.(position.x, position.z);
      if (ground !== null && ground !== undefined) position.y = ground;
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
        id: index, intact, destroyed, arm, position: position.clone(),
        health: CONFIG.CATAPULTS.HITS_TO_DESTROY, state: "idle", timer: 1.8 + index * 1.6,
        destroyedState: false, recoil: 0, smokeTimer: 0,
      });
    }
  }

  activate() {
    this.active = true;
  }

  update(dt) {
    for (const catapult of this.catapults) {
      if (catapult.destroyedState) {
        catapult.smokeTimer -= dt;
        if (catapult.smokeTimer <= 0) {
          catapult.smokeTimer = .38;
          this.effects.smoke(catapult.position.clone().add(new THREE.Vector3(0, 1.2, 0)));
        }
        continue;
      }
      if (!this.active) continue;
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
    const target = aimPlayer
      ? this.player.position.clone().add(new THREE.Vector3(this.player.velocity.x * .35, -CONFIG.PLAYER.EYE_HEIGHT + .1, this.player.velocity.z * .35))
      : new THREE.Vector3((Math.random() - .5) * 11, .1, (Math.random() - .5) * 11);
    const start = catapult.position.clone().add(new THREE.Vector3(0, 3.2, 0));
    this.projectiles.launch({
      kind: aimPlayer ? "enemy-player" : "enemy-base",
      start, target, scale: 1.35, warning: true,
      onImpact: (position, kind) => {
        this.effects.groundImpact(position);
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
    this.effects.groundImpact(catapult.position.clone().add(new THREE.Vector3(0, .6, 0)));
    if (catapult.health <= 0) this.destroy(catapult);
    return true;
  }

  destroy(catapult) {
    catapult.destroyedState = true;
    catapult.intact.visible = false;
    catapult.destroyed.visible = true;
    catapult.smokeTimer = 0;
    this.effects.constructionBurst(catapult.position.clone(), 30);
    this.notes.drop(catapult.position, 2);
    this.onDestroyed(catapult.id);
  }

  stop() {
    this.active = false;
  }
}
