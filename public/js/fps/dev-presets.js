import * as THREE from "three";
import { CONFIG } from "./config.js";


function groundPosition(game, x, z) {
  const ground = game.player.groundHeight(x, z) ?? 0;
  return new THREE.Vector3(x, ground + CONFIG.PLAYER.EYE_HEIGHT, z);
}


function lookAt(game, target) {
  const direction = target.clone().sub(game.player.position).normalize();
  game.player.yaw = Math.atan2(-direction.x, -direction.z);
  game.player.pitch = Math.asin(THREE.MathUtils.clamp(direction.y, -1, 1));
  game.camera.rotation.set(game.player.pitch, game.player.yaw, 0);
  game.camera.position.copy(game.player.position);
}


function place(game, x, z, target, height = null) {
  const position = height === null ? groundPosition(game, x, z) : new THREE.Vector3(x, height, z);
  game.player.position.copy(position);
  game.camera.position.copy(position);
  lookAt(game, target);
}


function instantFort(game, stage, gateOpen = false) {
  while (game.fort.stage < stage) {
    game.fort.buildNext();
    game.fort.update(2);
  }
  if (stage !== 3) return;
  game.fort.groups[3].scale.set(1, 1, 1);
  game.fort.gateOpen = gateOpen;
  game.fort.gateState = gateOpen ? "open" : "closed";
  game.fort.gateAnimation = gateOpen ? 1 : 0;
  if (game.fort.gateLeft) game.fort.gateLeft.rotation.y = gateOpen ? -1.25 : 0;
  if (game.fort.gateRight) game.fort.gateRight.rotation.y = gateOpen ? 1.25 : 0;
  game.navigation.switchState(3, gateOpen);
}


function showTreeStage(game, stageIndex, state = "showcase") {
  const tree = game.chopping.trees[0];
  if (!tree) return null;
  tree.hits = Math.min(stageIndex, CONFIG.CHOP.HITS);
  tree.state = state;
  game.chopping.showStage(tree, stageIndex);
  return tree;
}


function frameTree(game, stageIndex = 0) {
  const tree = showTreeStage(game, stageIndex);
  if (!tree) return;
  const target = tree.root.position.clone().add(new THREE.Vector3(0, 1.2, 0));
  place(game, target.x + 2.8, target.z + 2.8, target);
}


function marchGoblins(game, seconds = 16) {
  instantFort(game, 3, false);
  game.activateAttack();
  const health = game.fort.health;
  const maxHealth = game.fort.maxHealth;
  game.fort.maxHealth = 1000000;
  game.fort.health = 1000000;
  const steps = Math.ceil(seconds / .05);
  for (let index = 0; index < steps; index += 1) game.goblins.update(.05);
  game.fort.maxHealth = maxHealth;
  game.fort.health = health;
  game.fort.applyDamageVisuals();
  for (const agent of game.goblins.agents) agent.attackTimer = 999;
}


function frameAgents(game, focusIndex = 0) {
  const agent = game.goblins.agents[focusIndex] || game.goblins.agents[0];
  if (!agent) return;
  const target = agent.object.position.clone().add(new THREE.Vector3(0, 1, 0));
  const outward = target.clone().setY(0).normalize();
  const camera = target.clone().addScaledVector(outward, 5).add(new THREE.Vector3(0, .7, 0));
  place(game, camera.x, camera.z, target, camera.y);
}


function launchAtApex(game, index = 0) {
  instantFort(game, 3, false);
  game.activateAttack();
  const catapult = game.catapults.catapults[index];
  game.catapults.fire(catapult);
  const projectile = game.projectiles.active[0];
  if (!projectile) return;
  const targetAge = projectile.duration * .5;
  while (projectile.age + .025 < targetAge) game.projectiles.update(.025);
}


function frameCatapult(game, index = 0, elevated = false) {
  const catapult = game.catapults.catapults[index];
  if (!catapult) return;
  const target = catapult.position.clone().add(new THREE.Vector3(0, 1.5, 0));
  const inward = catapult.position.clone().setY(0).normalize().multiplyScalar(-1);
  const camera = target.clone().addScaledVector(inward, 7).add(new THREE.Vector3(0, elevated ? 2.8 : .5, 0));
  place(game, camera.x, camera.z, target, camera.y);
}


export function applyDevPreset(game, preset) {
  const origin = new THREE.Vector3(0, 2.4, 0);
  switch (preset) {
    case "clearing":
      place(game, 0, 17, origin);
      break;
    case "tree": frameTree(game, 0); break;
    case "chop25": frameTree(game, 1); break;
    case "chop50": frameTree(game, 2); break;
    case "chop75": frameTree(game, 3); break;
    case "chop90": frameTree(game, 4); break;
    case "falling": {
      const tree = showTreeStage(game, 4);
      if (!tree) break;
      tree.models[4].rotation.z = 1.02;
      const target = tree.root.position.clone().add(new THREE.Vector3(0, 1.2, 0));
      place(game, target.x + 4.2, target.z + 3.4, target);
      break;
    }
    case "fallen": frameTree(game, 5); break;
    case "carry":
      game.player.setCarrying(true);
      game.ui.setCarrying(true);
      place(game, 3, 8, origin);
      break;
    case "fort1":
      instantFort(game, 1);
      place(game, 0, 17, origin);
      break;
    case "fort2":
      instantFort(game, 2);
      place(game, 0, 17, origin);
      break;
    case "fort3":
      instantFort(game, 3, false);
      place(game, 0, 18, origin);
      break;
    case "inside":
      instantFort(game, 3, false);
      place(game, 0, -1.5, new THREE.Vector3(5, 4.5, -4));
      break;
    case "towerbelow":
      instantFort(game, 3, false);
      place(game, 2.2, -7.3, game.fort.towerPosition());
      break;
    case "tower":
      instantFort(game, 3, false);
      game.player.rig.setMode("stone");
      game.tower.atTower = true;
      game.player.movementLocked = true;
      place(game, 4.7, -3.9, game.catapults.catapults[0].position.clone().add(new THREE.Vector3(0, 1.2, 0)), 7.35);
      break;
    case "gateopen":
      instantFort(game, 3, true);
      place(game, 0, 15.5, new THREE.Vector3(0, 2.1, 8.5));
      break;
    case "gateclosed":
      instantFort(game, 3, false);
      place(game, 0, 15.5, new THREE.Vector3(0, 2.1, 8.5));
      break;
    case "goblins":
      marchGoblins(game, 14);
      frameAgents(game, 0);
      break;
    case "segments":
      marchGoblins(game, 18);
      place(game, 0, 17, new THREE.Vector3(0, 1.2, 9.5));
      break;
    case "catapult":
      instantFort(game, 3, false);
      game.activateAttack();
      game.catapults.catapults[0].timer = .3;
      frameCatapult(game, 0);
      break;
    case "apex":
      launchAtApex(game, 0);
      frameCatapult(game, 0, true);
      break;
    case "damaged":
      instantFort(game, 3, false);
      game.fort.health = game.fort.maxHealth;
      game.fort.applyDamageVisuals();
      game.fort.damage(520);
      place(game, 0, 14.5, new THREE.Vector3(0, 2.3, 9.2));
      break;
    case "repair":
      instantFort(game, 3, false);
      game.fort.health = game.fort.maxHealth;
      game.fort.applyDamageVisuals();
      game.fort.damage(520);
      game.fort.repair();
      place(game, 0, 14.5, new THREE.Vector3(0, 2.3, 9.2));
      break;
    case "destroyed":
      instantFort(game, 3, false);
      if (!game.catapults.catapults[0].destroyedState) game.catapults.destroy(game.catapults.catapults[0]);
      frameCatapult(game, 0);
      break;
    case "note": {
      instantFort(game, 3, false);
      if (!game.catapults.catapults[0].destroyedState) game.catapults.destroy(game.catapults.catapults[0]);
      const note = game.notes.notes[0];
      if (note) {
        const target = note.object.position.clone();
        place(game, target.x + 2.4, target.z + 2.4, target);
      }
      break;
    }
    case "pickup": {
      instantFort(game, 3, false);
      if (!game.catapults.catapults[0].destroyedState) game.catapults.destroy(game.catapults.catapults[0]);
      const note = game.notes.notes[0];
      if (note) {
        place(game, note.object.position.x, note.object.position.z, game.catapults.catapults[0].position.clone().add(new THREE.Vector3(0, 1, 0)));
        game.notes.update(.1, game.player.position);
      }
      break;
    }
    case "victory":
      instantFort(game, 3, false);
      for (const catapult of game.catapults.catapults) {
        if (!catapult.destroyedState) game.catapults.destroy(catapult);
      }
      for (const note of game.notes.notes) {
        note.object.position.copy(game.player.position).add(new THREE.Vector3(0, -CONFIG.PLAYER.EYE_HEIGHT + .24, 0));
        note.baseY = note.object.position.y;
      }
      game.notes.update(.1, game.player.position);
      break;
    default:
      break;
  }
  game.findInteraction();
  game.updateUI(.016);
}


export class DevDemoDirector {
  constructor(game) {
    this.game = game;
    this.time = 0;
    this.index = 0;
    this.events = [
      [0, () => {
        applyDevPreset(game, "clearing");
        if (!game.navigation.debugVisible) {
          game.navigation.toggleDebug(true);
          game.ui.setDebug(true);
        }
      }],
      [2.2, () => applyDevPreset(game, "tree")],
      [4.0, () => game.chopping.applyHit(game.chopping.trees[0])],
      [5.35, () => game.chopping.applyHit(game.chopping.trees[0])],
      [6.7, () => game.chopping.applyHit(game.chopping.trees[0])],
      [8.05, () => game.chopping.applyHit(game.chopping.trees[0])],
      [10.1, () => {
        // Skip the trunk linger delay so the scripted demo keeps its pacing.
        game.chopping.update(CONFIG.CHOP.TRUNK_LINGER_SECONDS + .05);
        const log = game.chopping.trees[0]?.log;
        if (log) game.chopping.pickup(log);
        game.ui.setCarrying(true);
        applyDevPreset(game, "carry");
      }],
      [11.8, () => game.deliverLog()],
      [13.4, () => { game.player.setCarrying(true); game.ui.setCarrying(true); game.deliverLog(); }],
      [15.0, () => { game.player.setCarrying(true); game.ui.setCarrying(true); game.deliverLog(); }],
      [17.0, () => applyDevPreset(game, "fort3")],
      [18.7, () => applyDevPreset(game, "gateclosed")],
      [20.2, () => {
        game.activateAttack();
        game.ui.warning("NAVMESH: Р’Р РђР“Р РџР•Р Р•РЎРўР РђРР’РђР®Рў РњРђР РЁР РЈРўР«", 3000);
      }],
      [21.4, () => {
        const steps = Math.ceil(13 / .05);
        for (let step = 0; step < steps; step += 1) game.goblins.update(.05);
        frameAgents(game, 0);
      }],
      [24.0, () => applyDevPreset(game, "segments")],
      [25.3, () => game.goblins.stop()],
      [26.0, () => {
        frameCatapult(game, 0);
        game.catapults.fire(game.catapults.catapults[0]);
      }],
      [27.45, () => frameCatapult(game, 0, true)],
      [29.4, () => applyDevPreset(game, "damaged")],
      [30.8, () => applyDevPreset(game, "repair")],
      [32.1, () => {
        applyDevPreset(game, "tower");
        game.tower.stoneReady = true;
        game.tower.throwAt(0);
      }],
      [34.55, () => {
        game.tower.stoneReady = true;
        game.player.setStoneMode(true);
        game.tower.throwAt(0);
      }],
      [37.0, () => applyDevPreset(game, "destroyed")],
      [38.25, () => applyDevPreset(game, "note")],
      [39.8, () => applyDevPreset(game, "pickup")],
      [42.0, () => applyDevPreset(game, "victory")],
    ];
  }

  update(dt) {
    if (this.game.gameOver) return;
    this.time += dt;
    while (this.index < this.events.length && this.time >= this.events[this.index][0]) {
      this.events[this.index][1]();
      this.index += 1;
    }
  }
}
