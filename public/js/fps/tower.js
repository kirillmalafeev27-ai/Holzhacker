import * as THREE from "three";
import { QuestionDeck } from "../questions.js";


export class TowerSystem {
  constructor(player, input, ui, fort, catapults, projectiles, audio) {
    this.player = player;
    this.input = input;
    this.ui = ui;
    this.fort = fort;
    this.catapults = catapults;
    this.projectiles = projectiles;
    this.audio = audio;
    this.deck = new QuestionDeck();
    this.atTower = false;
    this.question = null;
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
    if (!this.atTower || this.question) return false;
    this.atTower = false;
    this.stoneReady = false;
    this.ui.setTowerTargets(false);
    this.player.setStoneMode(false);
    this.player.movementLocked = false;
    this.player.position.set(4.7, 1.72, -6.1);
    this.player.camera.position.copy(this.player.position);
    return true;
  }

  openQuestion() {
    if (!this.atTower || this.question || this.stoneReady || this.transition) return false;
    this.question = this.deck.next();
    document.exitPointerLock?.();
    this.ui.showQuestion(this.question, (option) => this.answer(option));
    return true;
  }

  answer(option) {
    if (!this.question) return;
    const correct = option === this.question.answer;
    this.ui.questionResult(correct);
    if (correct) {
      this.stoneReady = true;
      this.player.setStoneMode(true);
      setTimeout(() => {
        this.question = null;
        this.ui.hideQuestion();
        this.ui.setTowerTargets(true);
        this.input.requestLock();
      }, 650);
    } else {
      setTimeout(() => {
        this.question = this.deck.next();
        this.ui.showQuestion(this.question, (next) => this.answer(next));
      }, 850);
    }
  }

  throwAt(index) {
    if (!this.atTower || !this.stoneReady || this.transition) return false;
    const target = this.catapults.catapults[index];
    if (!target || target.destroyedState) {
      this.ui.toast("Эта катапульта уже разрушена");
      return false;
    }
    this.stoneReady = false;
    this.ui.setTowerTargets(false);
    this.player.setStoneMode(false);
    const start = this.player.position.clone().add(new THREE.Vector3(.2, -.15, 0));
    const end = target.position.clone().add(new THREE.Vector3(0, .85, 0));
    this.projectiles.launch({
      kind: "player-stone", start, target: end, scale: 1.05, warning: false,
      flightTime: 2.15,
      onImpact: () => {
        this.audio.play("impact");
        this.catapults.hit(index);
      },
    });
    this.ui.toast(`Камень летит к катапульте ${index + 1}`);
    return true;
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
        this.ui.toast("E — немецкое задание · X — спуститься");
      }
    }
    if (this.input.consume("KeyX")) this.leave();
    if (this.stoneReady) {
      if (this.input.consume("Digit1")) this.throwAt(0);
      if (this.input.consume("Digit2")) this.throwAt(1);
      if (this.input.consume("Digit3")) this.throwAt(2);
    }
  }
}
