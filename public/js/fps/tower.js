import * as THREE from "three";
import { CONFIG } from "./config.js";


export class TowerSystem {
  constructor(player, input, ui, fort, catapults, projectiles, effects, audio, learning) {
    this.player = player;
    this.input = input;
    this.ui = ui;
    this.fort = fort;
    this.catapults = catapults;
    this.projectiles = projectiles;
    this.effects = effects;
    this.audio = audio;
    this.learning = learning;
    this.atTower = false;
    this.questionPending = false;
    this.stoneReady = false;
    this.transition = null;
    this.savedPosition = new THREE.Vector3();
  }

  enter() {
    if (this.atTower || this.fort.stage < 3) return false;
    this.atTower = true;
    this.savedPosition.copy(this.player.position);
    this.transition = { time: 0, duration: 1.1, start: this.player.position.clone(), end: this.fort.towerPosition() };
    this.player.movementLocked = true;
    this.player.setStoneMode(false);
    this.ui.toast("Вы поднимаетесь на башню");
    return true;
  }

  leave() {
    if (!this.atTower || this.questionPending || this.learning?.active) return false;
    this.atTower = false;
    this.stoneReady = false;
    this.ui.setTowerTargets(false);
    this.ui.setLeaveTower(false);
    this.player.setStoneMode(false);
    this.player.movementLocked = false;
    this.player.position.set(4.7, 1.72, -6.1);
    this.player.camera.position.copy(this.player.position);
    this.input.requestLock();
    return true;
  }

  async openQuestion() {
    if (!this.atTower || this.questionPending || this.learning?.active || this.stoneReady || this.transition) return false;
    this.questionPending = true;
    try {
      const correct = await this.learning.request("stone", { source: "watchtower" });
      if (!correct || !this.atTower) {
        this.ui.toast("Камень не подготовлен — решите следующее задание");
        return false;
      }
      this.stoneReady = true;
      this.player.setStoneMode(true);
      this.ui.setTowerTargets(true);
      this.ui.toast("Верно — камень готов. Прицельтесь перекрестием");
      return true;
    } finally {
      this.questionPending = false;
    }
  }

  throwAimed() {
    if (!this.atTower || !this.stoneReady || this.transition) return false;
    this.stoneReady = false;
    this.ui.setTowerTargets(false);
    this.player.setStoneMode(false);
    const direction = new THREE.Vector3();
    this.player.camera.getWorldDirection(direction).normalize();
    const start = this.player.position.clone().addScaledVector(direction, .65).add(new THREE.Vector3(.18, -.22, 0));
    this.projectiles.launchVelocity({
      kind: "player-stone", start, velocity: direction.multiplyScalar(CONFIG.CATAPULTS.PLAYER_THROW_SPEED),
      scale: 1.05, maxTime: 5, groundHeight: -Infinity,
      shouldImpact: (position) => {
        const catapult = this.catapults.catapults.find((candidate) => {
          if (candidate.destroyedState) return false;
          const horizontal = Math.hypot(position.x - candidate.position.x, position.z - candidate.position.z);
          return horizontal < CONFIG.CATAPULTS.HIT_RADIUS && position.y < candidate.position.y + 3.4;
        });
        if (catapult) return { type: "catapult", catapult };
        const ground = this.player.groundHeight(position.x, position.z);
        return ground !== null && position.y <= ground + .16 ? { type: "ground", ground } : null;
      },
      onImpact: (position, _kind, contact) => {
        this.audio.play("impact");
        if (contact?.type === "catapult") {
          this.catapults.hit(contact.catapult.id);
          this.ui.toast(`Попадание по катапульте ${contact.catapult.id + 1}`);
        } else {
          if (contact?.ground !== undefined) position.y = contact.ground + .05;
          this.effects.dirtImpact(position);
          this.ui.toast("Камень ушёл в землю — скорректируйте угол");
        }
      },
    });
    this.ui.toast("Бросок по перекрестию");
    return true;
  }

  throwAt(index) {
    if (!this.atTower || !this.stoneReady || this.transition) return false;
    const target = this.catapults.catapults[index];
    if (!target || target.destroyedState) return false;
    this.stoneReady = false;
    this.ui.setTowerTargets(false);
    this.player.setStoneMode(false);
    const start = this.player.position.clone().add(new THREE.Vector3(.2, -.15, 0));
    const end = target.position.clone().add(new THREE.Vector3(0, .85, 0));
    return Boolean(this.projectiles.launch({
      kind: "player-stone-demo", start, target: end, scale: 1.05, warning: false,
      flightTime: 2.15,
      onImpact: () => {
        this.audio.play("impact");
        this.catapults.hit(index);
      },
    }));
  }

  update(dt) {
    if (this.transition) {
      this.transition.time += dt;
      const t = Math.min(1, this.transition.time / this.transition.duration);
      const eased = t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      this.player.position.lerpVectors(this.transition.start, this.transition.end, eased);
      this.player.camera.position.copy(this.player.position);
      if (t >= 1) {
        this.transition = null;
        this.ui.setLeaveTower(true);
        this.ui.toast("E — тест для камня · X или кнопка — спуститься");
      }
    }
    if (this.input.consume("KeyX")) this.leave();
    if (this.stoneReady && this.input.consume("Mouse0")) this.throwAimed();
  }
}
