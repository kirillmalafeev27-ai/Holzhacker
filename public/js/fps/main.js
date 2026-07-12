import * as THREE from "three";
import { AssetStore } from "./assets.js";
import { CONFIG, runtimeConfig } from "./config.js";
import { InputController } from "./input.js";
import { FirstPersonController } from "./player.js";
import { NavigationSystem } from "./navigation.js";
import { FortSystem } from "./fort.js";
import { EffectsSystem, AudioSystem } from "./effects.js";
import { ChoppingSystem } from "./chopping.js";
import { ProjectileSystem } from "./projectiles.js";
import { NoteSystem } from "./notes.js";
import { GoblinSystem, CatapultSystem } from "./enemies.js";
import { TowerSystem } from "./tower.js";
import { UIManager } from "./ui.js";
import { applyDevPreset, DevDemoDirector } from "./dev-presets.js";


class WaldwachtGame {
  constructor() {
    this.canvas = document.getElementById("game");
    this.ui = new UIManager();
    this.runtime = runtimeConfig();
    this.clock = new THREE.Timer();
    this.clock.connect(document);
    this.elapsed = 0;
    this.realElapsed = 0;
    this.logsDelivered = 0;
    this.attackActive = false;
    this.warning30 = false;
    this.warning10 = false;
    this.gameStarted = false;
    this.gameOver = false;
    this.paused = true;
    this.currentInteraction = null;
    this.frames = 0;
    this.fps = 60;
    this.fpsTimer = 0;
    this.ambientTimer = 0;
    this.state = "loading";
    this.setupRenderer();
  }

  setupRenderer() {
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.8));
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.16;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x718b79);
    this.scene.fog = new THREE.Fog(0x6f8774, CONFIG.WORLD.FOG_NEAR, CONFIG.WORLD.FOG_FAR);
    this.camera = new THREE.PerspectiveCamera(68, innerWidth / innerHeight, .06, 130);
    this.scene.add(this.camera);
    const hemisphere = new THREE.HemisphereLight(0xc3d8cf, 0x30331f, 1.42);
    this.scene.add(hemisphere);
    this.sun = new THREE.DirectionalLight(0xffc276, 3.15);
    this.sun.position.set(-34, 45, 22);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.camera.left = -45;
    this.sun.shadow.camera.right = 45;
    this.sun.shadow.camera.top = 45;
    this.sun.shadow.camera.bottom = -45;
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 110;
    this.sun.shadow.bias = -.0006;
    this.scene.add(this.sun);
    const warmFill = new THREE.DirectionalLight(0x85a7c2, .55);
    warmFill.position.set(28, 18, -25);
    this.scene.add(warmFill);
    window.addEventListener("resize", () => this.resize());
  }

  async init() {
    try {
      this.assets = new AssetStore((progress, key) => this.ui.setLoading(progress, key));
      await this.assets.loadAll();
      this.setupSystems();
      this.bindUI();
      this.ui.loadingComplete();
      this.state = "ready";
      this.renderer.setAnimationLoop(() => this.loop());
    } catch (error) {
      console.error(error);
      this.ui.elements.loadingStatus.textContent = `Ошибка загрузки: ${error.message}`;
      this.ui.elements.loadingDetail.textContent = "Проверьте установку Three.js и локальный сервер";
    }
  }

  setupSystems() {
    this.world = this.assets.clone("world");
    this.world.name = "FirstPersonWorld";
    this.assets.optimizeWorldClone(this.world);
    this.scene.add(this.world);
    this.world.updateMatrixWorld(true);
    const terrainMeshes = [];
    const waterMeshes = [];
    this.world.traverse((object) => {
      if (!object.isMesh) return;
      object.receiveShadow = true;
      if (/WorldTerrain|StreamBridge/.test(object.name) || object.userData?.collision === "bridge") terrainMeshes.push(object);
      if (/ForestStream/.test(object.name) || object.material?.name === "StreamWater") waterMeshes.push(object);
      if (/Undergrowth|ClearingDetail|TowerFlag/.test(object.name)) object.userData.windPhase = Math.random() * Math.PI * 2;
    });
    this.waterMeshes = waterMeshes;
    this.windObjects = [];
    this.world.traverse((object) => { if (object.userData.windPhase !== undefined) this.windObjects.push(object); });

    this.input = new InputController(this.canvas);
    this.effects = new EffectsSystem(this.scene);
    this.audio = new AudioSystem();
    this.navigation = new NavigationSystem(this.scene, this.assets);
    this.player = new FirstPersonController(this.camera, this.input, this.assets);
    const spawn = this.assets.markerPosition("PlayerSpawn") || new THREE.Vector3(0, 1.72, 15);
    this.player.spawn(spawn);
    const colliders = this.assets.worldCollisionData();
    this.fort = new FortSystem(this.scene, this.assets, this.navigation, this.effects);
    this.player.setEnvironment(terrainMeshes, colliders, (next, previous) => this.fort.resolvePlayerCollision(next, previous));
    this.chopping = new ChoppingSystem(this.scene, this.assets, this.player, this.effects, this.audio);
    colliders.push(...this.chopping.collisionData());
    this.navigation.setObstacleDebug(colliders);
    this.projectiles = new ProjectileSystem(this.scene, this.assets, this.effects, this.audio);
    this.notes = new NoteSystem(this.scene, this.assets, this.navigation, this.audio);
    this.goblins = new GoblinSystem(this.scene, this.assets, this.navigation, this.fort, this.effects, this.audio);
    this.catapults = new CatapultSystem(this.scene, this.assets, this.projectiles, this.fort, this.player, this.notes, this.effects, this.audio);
    this.tower = new TowerSystem(this.player, this.input, this.ui, this.fort, this.catapults, this.projectiles, this.audio);
    this.setupCallbacks();
    if (this.runtime.navDebug) {
      this.navigation.toggleDebug(true);
      this.ui.setDebug(true);
    }
    this.exposeDebugAPI();
  }

  setupCallbacks() {
    this.player.onDamage = () => {
      this.ui.flashDamage();
      this.ui.warning("ВЫ РАНЕНЫ", 1700);
      this.audio.play("damage");
    };
    this.player.onDeath = () => this.endGame("player");
    this.fort.onStageChanged = (stage) => {
      this.audio.play("build");
      this.ui.toast(stage === 3 ? "Крепость готова — башня и ворота активны" : `Строительство крепости: ${stage} / 3`);
      this.goblins.repathAll();
    };
    this.fort.onHealthChanged = (health, delta) => {
      if (delta < 0 && Math.random() < .32) this.ui.toast("Частокол получает повреждения");
      if (health <= 0) this.endGame("base");
    };
    this.fort.onGateChanged = (open) => {
      this.audio.play("gate");
      this.ui.toast(open ? "Ворота открыты" : "Ворота закрыты — navmesh обновлён");
      this.goblins.repathAll();
    };
    this.notes.onCollected = (count) => {
      this.player.rig.pickupReaction();
      this.ui.toast(`Записка найдена: ${count} / ${CONFIG.NOTES.TOTAL}`);
      if (count >= CONFIG.NOTES.TOTAL && this.player.health > 0 && this.fort.health > 0) this.endGame("victory");
    };
    this.catapults.onDestroyed = (index) => this.ui.toast(`Катапульта ${index + 1} разрушена — выпали записки`);
    this.goblins.onBaseAttack = () => { if (Math.random() < .24) this.ui.toast("Гоблины рубят частокол"); };
  }

  bindUI() {
    const startGame = (withAudio = true) => {
      if (this.gameStarted) return;
      if (withAudio) this.audio.start();
      this.gameStarted = true;
      this.paused = false;
      this.state = "exploration";
      this.ui.startGame();
      if (!this.runtime.dev) this.input.requestLock();
    };
    this.ui.elements.startButton.addEventListener("click", () => startGame(true));
    this.ui.elements.pause.addEventListener("click", () => this.input.requestLock());
    this.ui.elements.restart.addEventListener("click", () => location.reload());
    this.input.onLockChange = (locked) => {
      if (this.runtime.dev) return;
      if (!this.gameStarted || this.gameOver || this.tower?.question) return;
      this.paused = !locked;
      this.ui.setPaused(this.paused);
    };
    if (this.runtime.dev) queueMicrotask(() => {
      startGame(false);
      if (this.runtime.preset) applyDevPreset(this, this.runtime.preset);
      if (this.runtime.demo) this.demoDirector = new DevDemoDirector(this);
    });
  }

  loop() {
    this.clock.update();
    const realDt = Math.min(this.clock.getDelta(), .05);
    this.realElapsed += realDt;
    if (!this.gameStarted || this.gameOver) {
      this.animateEnvironment(realDt);
      this.effects?.update(realDt);
      this.renderer.render(this.scene, this.camera);
      return;
    }
    const modalPaused = Boolean(this.tower.question);
    const paused = this.paused || modalPaused;
    this.player.update(realDt, paused);
    this.demoDirector?.update(realDt);
    if (!paused) {
      const simulationDt = realDt * this.runtime.timeScale;
      this.elapsed += simulationDt;
      this.updateAttackTimer();
      this.handleInput();
      this.fort.update(realDt);
      this.chopping.update(realDt);
      this.goblins.update(simulationDt);
      this.catapults.update(simulationDt);
      this.projectiles.update(realDt);
      this.notes.update(realDt, this.player.position);
      this.tower.update(realDt);
      this.findInteraction();
      this.animateEnvironment(realDt);
      this.effects.update(realDt);
      this.updateUI(realDt);
      this.input.endFrame();
    }
    this.renderer.render(this.scene, this.camera);
  }

  updateAttackTimer() {
    const remaining = CONFIG.ATTACK.START_SECONDS - this.elapsed;
    if (!this.warning30 && remaining <= CONFIG.ATTACK.WARNING_SECONDS && remaining > CONFIG.ATTACK.FINAL_WARNING_SECONDS) {
      this.warning30 = true;
      this.ui.warning("ДО НАПАДЕНИЯ 30 СЕКУНД");
    }
    if (!this.warning10 && remaining <= CONFIG.ATTACK.FINAL_WARNING_SECONDS && remaining > 0) {
      this.warning10 = true;
      this.ui.warning("ВРАГ УЖЕ БЛИЗКО");
    }
    if (!this.attackActive && remaining <= 0) this.activateAttack();
  }

  activateAttack() {
    if (this.attackActive || this.gameOver) return;
    this.attackActive = true;
    this.state = "defense";
    this.ui.warning("НАПАДЕНИЕ НАЧАЛОСЬ", 4500);
    this.goblins.spawn();
    this.catapults.activate();
  }

  handleInput() {
    if (this.input.consume("F3")) {
      const visible = this.navigation.toggleDebug();
      this.ui.setDebug(visible);
      this.ui.toast(visible ? "Navmesh debug включён" : "Navmesh debug скрыт");
    }
    if (this.input.consume("KeyE")) this.interact();
    if (this.player.dodgeTimer > 0) this.ui.flashDodge();
  }

  findInteraction() {
    this.currentInteraction = null;
    if (this.tower.atTower) {
      if (!this.tower.transition) this.currentInteraction = { label: this.tower.stoneReady ? "Выберите катапульту клавишами 1, 2 или 3" : "Открыть немецкое задание", action: () => this.tower.openQuestion() };
      this.ui.setPrompt(this.currentInteraction?.label || "");
      return;
    }
    const forward = this.camera.getWorldDirection(new THREE.Vector3());
    const chopInteraction = this.chopping.nearestInteractable(this.player.position, forward);
    if (chopInteraction?.type === "tree" && !this.player.carrying) {
      this.currentInteraction = { label: `Рубить дерево · удар ${chopInteraction.tree.hits + 1} / 4`, action: () => this.chopping.chop(chopInteraction.tree) };
    } else if (chopInteraction?.type === "log" && !this.player.carrying) {
      this.currentInteraction = { label: "Поднять бревно", action: () => this.pickupLog(chopInteraction.log) };
    } else if (this.player.carrying && this.fort.stage < 3 && Math.hypot(this.player.position.x, this.player.position.z) < CONFIG.BUILD.RADIUS) {
      this.currentInteraction = { label: "Передать бревно строителям", action: () => this.deliverLog() };
    } else if (this.player.carrying && this.fort.nearRepair(this.player.position)) {
      this.currentInteraction = { label: "Использовать бревно для ремонта", action: () => this.repairFort() };
    } else if (this.fort.nearGate(this.player.position) && this.fort.stage === 3) {
      this.currentInteraction = { label: this.fort.gateOpen ? "Закрыть ворота" : "Открыть ворота", action: () => this.fort.toggleGate() };
    } else if (this.fort.nearTower(this.player.position)) {
      this.currentInteraction = { label: "Подняться на башню", action: () => this.tower.enter() };
    }
    this.ui.setPrompt(this.currentInteraction?.label || "");
  }

  interact() {
    if (this.gameOver || this.paused || this.tower.question) return;
    this.currentInteraction?.action?.();
  }

  pickupLog(log) {
    if (!this.chopping.pickup(log)) return;
    this.ui.setCarrying(true);
    this.ui.toast("Бревно поднято — скорость снижена");
  }

  deliverLog() {
    if (!this.chopping.consumeCarriedLog()) return;
    this.logsDelivered += 1;
    this.ui.setCarrying(false);
    this.fort.buildNext();
  }

  repairFort() {
    if (this.fort.health >= this.fort.maxHealth) {
      this.ui.toast("Крепость не нуждается в ремонте");
      return;
    }
    const amount = this.fort.repair();
    if (!amount) return;
    this.chopping.consumeCarriedLog();
    this.ui.setCarrying(false);
    this.audio.play("repair");
    this.ui.toast(`Ремонт +${amount}`);
  }

  animateEnvironment(dt) {
    const time = this.realElapsed;
    for (const object of this.windObjects) {
      object.rotation.z = Math.sin(time * .8 + object.userData.windPhase) * .012;
    }
    for (const mesh of this.waterMeshes) {
      mesh.material.opacity = .72 + Math.sin(time * 1.4) * .06;
    }
    this.ambientTimer -= dt;
    if (this.ambientTimer <= 0 && this.effects) {
      this.ambientTimer = .28 + Math.random() * .25;
      const angle = Math.random() * Math.PI * 2;
      const position = this.player.position.clone().add(new THREE.Vector3(Math.cos(angle) * (4 + Math.random() * 6), 2 + Math.random() * 3, Math.sin(angle) * (4 + Math.random() * 6)));
      this.effects.spawn("wood", position, new THREE.Vector3((Math.random() - .5) * .2, -.12, (Math.random() - .5) * .2), 3.5, .35, -.02);
    }
  }

  objective() {
    if (this.fort.stage < 3) return { title: "Постройте крепость", text: "Срубите дуб, поднимите бревно и доставьте его в строительное кольцо." };
    if (!this.attackActive) return { title: "Подготовьтесь к нападению", text: "Проверьте ворота, башню и заготовьте древесину для ремонта." };
    if (this.notes.collected < CONFIG.NOTES.TOTAL) return { title: "Защитите Waldwacht", text: "Решайте задания на башне, уничтожайте катапульты и собирайте записки." };
    return { title: "Крепость спасена", text: "Все записки найдены." };
  }

  updateUI(dt) {
    this.frames += 1;
    this.fpsTimer += dt;
    if (this.fpsTimer >= .5) {
      this.fps = Math.round(this.frames / this.fpsTimer);
      this.frames = 0;
      this.fpsTimer = 0;
    }
    const selected = this.goblins.agents.find((agent) => !agent.defeated);
    this.ui.update({
      playerHealth: this.player.health,
      baseHealth: this.fort.health,
      elapsed: this.elapsed,
      attackActive: this.attackActive,
      logs: this.logsDelivered,
      stage: this.fort.stage,
      notes: this.notes.collected,
      objective: this.objective(),
      debug: {
        fps: this.fps,
        gate: this.fort.stage < 3 ? "N/A" : this.fort.gateState.toUpperCase(),
        agents: this.goblins.agents.length,
        path: selected ? `${selected.pathIndex}/${selected.path.length}` : "—",
        state: selected?.state || this.state,
      },
    });
  }

  endGame(reason) {
    if (this.gameOver) return;
    this.gameOver = true;
    this.state = reason === "victory" ? "victory" : reason === "player" ? "playerDefeated" : "baseDestroyed";
    this.goblins.stop();
    this.catapults.stop();
    this.projectiles.clear();
    document.exitPointerLock?.();
    this.ui.end(reason, { notes: this.notes.collected, baseHealth: this.fort.health });
  }

  resize() {
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.8));
    this.renderer.setSize(innerWidth, innerHeight);
  }

  exposeDebugAPI() {
    window.__waldwacht = {
      game: this,
      snapshot: () => ({
        state: this.state, elapsed: this.elapsed, player: { health: this.player.health, position: this.player.position.toArray() },
        base: { stage: this.fort.stage, health: this.fort.health, gate: this.fort.gateState },
        notes: this.notes.collected, attack: this.attackActive,
        goblins: this.goblins.agents.map((agent) => ({ state: agent.state, path: agent.path.length, position: agent.object.position.toArray() })),
        catapults: this.catapults.catapults.map((catapult) => ({ health: catapult.health, destroyed: catapult.destroyedState })),
      }),
      debug: {
        buildNext: () => { if (this.fort.stage < 3) { this.player.setCarrying(true); this.deliverLog(); } },
        buildComplete: () => { while (this.fort.stage < 3) { this.player.setCarrying(true); this.deliverLog(); } },
        startAttack: () => this.activateAttack(),
        toggleNavmesh: () => { const visible = this.navigation.toggleDebug(); this.ui.setDebug(visible); },
        damageBase: (amount=350) => this.fort.damage(amount),
        repairBase: () => { this.player.setCarrying(true); this.fort.repair(); },
        enterTower: () => { while (this.fort.stage < 3) this.fort.buildNext(); this.tower.enter(); },
        destroyCatapult: (index=0) => { const target = this.catapults.catapults[index]; if (target) { target.health = 1; this.catapults.hit(index); } },
        placeNotesAtPlayer: () => { for (const note of this.notes.notes) { note.object.position.copy(this.player.position).add(new THREE.Vector3(0, -1.4, 0)); note.baseY = note.object.position.y; } },
        defeatPlayer: () => { this.player.health = 1; this.player.invulnerability = 0; this.player.damage(); },
        defeatBase: () => { this.fort.health = 1; this.fort.damage(2); },
      },
    };
  }
}


const game = new WaldwachtGame();
game.init();
