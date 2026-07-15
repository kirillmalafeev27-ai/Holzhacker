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
import { LearningSystem } from "./learning-system.js";
import { applyDevPreset, DevDemoDirector } from "./dev-presets.js";
import { adjustedCatapultPosition, blocksTowerShot, catapultArrivalEndpoints, catapultPositionPool, distanceToSegment2D, relocateOffTowerShots } from "./world-layout.js";
import { PerformanceDetector, shouldKeepDecoration } from "./performance.js";


class WaldwachtGame {
  constructor() {
    this.canvas = document.getElementById("game");
    this.ui = new UIManager();
    this.performance = new PerformanceDetector();
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
    this.environmentFrame = 0;
    this.state = "loading";
    this.setupRenderer();
  }

  setupRenderer() {
    const initialProfile = this.performance.profile;
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: initialProfile.antialias, powerPreference: "high-performance" });
    this.performance.refineWithRenderer(this.renderer);
    const profile = this.performance.profile;
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, profile.pixelRatio));
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.AgXToneMapping;
    this.renderer.toneMappingExposure = 1.28;
    this.renderer.shadowMap.enabled = profile.shadows;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xc9efff);
    this.scene.fog = new THREE.Fog(0xd9efcf, profile.fogNear, profile.fogFar);
    this.camera = new THREE.PerspectiveCamera(68, innerWidth / innerHeight, .06, profile.cameraFar);
    this.scene.add(this.camera);
    this.createSky();
    const hemisphere = new THREE.HemisphereLight(0xe5f7ff, 0x96c83b, 2.12);
    hemisphere.layers.enable(1);
    this.scene.add(hemisphere);
    this.sun = new THREE.DirectionalLight(0xfff0bd, 4.0);
    this.sun.position.set(-38, 52, -24);
    this.sun.castShadow = profile.shadows;
    this.sun.shadow.mapSize.set(profile.shadowMapSize, profile.shadowMapSize);
    this.sun.shadow.camera.left = -45;
    this.sun.shadow.camera.right = 45;
    this.sun.shadow.camera.top = 45;
    this.sun.shadow.camera.bottom = -45;
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 110;
    this.sun.shadow.bias = -.0006;
    this.sun.layers.enable(1);
    this.scene.add(this.sun);
    const warmFill = new THREE.DirectionalLight(0x9ed7ff, .82);
    warmFill.position.set(30, 22, 28);
    warmFill.layers.enable(1);
    this.scene.add(warmFill);
    this.ui.setPerformanceProfile(profile, this.performance.description());
    window.addEventListener("resize", () => this.resize());
  }

  createSky() {
    const material = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {},
      vertexShader: `
        varying vec3 vDirection;
        void main() {
          vec4 world = modelMatrix * vec4(position, 1.0);
          vDirection = world.xyz - cameraPosition;
          gl_Position = projectionMatrix * viewMatrix * world;
        }
      `,
      fragmentShader: `
        varying vec3 vDirection;
        void main() {
          vec3 direction = normalize(vDirection);
          float heightMix = smoothstep(-0.12, 0.72, direction.y);
          vec3 horizon = vec3(0.91, 0.98, 0.94);
          vec3 zenith = vec3(0.36, 0.73, 0.95);
          vec3 color = mix(horizon, zenith, heightMix);
          vec3 sunDirection = normalize(vec3(-0.48, 0.72, -0.42));
          float sun = pow(max(dot(direction, sunDirection), 0.0), 72.0);
          color += vec3(1.0, 0.84, 0.50) * sun * 0.72;
          float cloudBand = smoothstep(0.05, 0.28, direction.y) * (1.0 - smoothstep(0.66, 0.88, direction.y));
          float ribbons = sin(direction.x * 24.0 + direction.z * 15.0) * 0.5 + sin(direction.x * 41.0 - direction.z * 11.0) * 0.28;
          float clouds = smoothstep(0.48, 0.86, ribbons) * cloudBand * 0.30;
          color = mix(color, vec3(1.0), clouds);
          gl_FragColor = vec4(color, 1.0);
        }
      `,
    });
    const profile = this.performance.profile;
    const sky = new THREE.Mesh(new THREE.SphereGeometry(145, profile.skyWidthSegments, profile.skyHeightSegments), material);
    sky.name = "StylizedSky";
    sky.frustumCulled = false;
    sky.renderOrder = -1000;
    this.scene.add(sky);
  }

  async init() {
    try {
      this.assets = new AssetStore((progress, key) => this.ui.setLoading(progress, key), this.performance.profile.id);
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
    this.removedLowEndDecorations = this.reduceDecorationsForProfile(this.world);
    const initialCatapultPads = ["CatapultSpawn_A", "CatapultSpawn_B", "CatapultSpawn_C"]
      .map((name) => this.assets.markerPosition(name))
      .filter(Boolean)
      .map((position) => adjustedCatapultPosition(position));
    const catapultPads = catapultPositionPool(initialCatapultPads);
    const towerMarker = this.assets.markerPosition("Watchtower") || new THREE.Vector3(4.7, 0, -3.9);
    towerMarker.y = 0;
    this.clearCatapultPadsAndCorridors(this.world, catapultPads, towerMarker);
    const colliders = this.assets.worldCollisionData(this.world);
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
    this.effects = new EffectsSystem(this.scene, { profileId: this.performance.profile.id });
    this.audio = new AudioSystem();
    this.navigation = new NavigationSystem(this.scene, this.assets);
    this.player = new FirstPersonController(this.camera, this.input, this.assets);
    const spawn = this.assets.markerPosition("PlayerSpawn") || new THREE.Vector3(0, 1.72, 15);
    this.player.spawn(spawn);
    this.fort = new FortSystem(this.scene, this.assets, this.navigation, this.effects);
    this.player.setEnvironment(terrainMeshes, colliders, (next, previous) => this.fort.resolvePlayerCollision(next, previous));
    this.chopping = new ChoppingSystem(this.scene, this.assets, this.player, this.effects, this.audio);
    colliders.push(...this.chopping.collisionData());
    this.projectiles = new ProjectileSystem(this.scene, this.assets, this.effects, this.audio);
    this.notes = new NoteSystem(this.scene, this.assets, this.navigation, this.audio);
    this.goblins = new GoblinSystem(this.scene, this.assets, this.navigation, this.fort, this.effects, this.audio);
    this.catapults = new CatapultSystem(this.scene, this.assets, this.projectiles, this.fort, this.player, this.notes, this.effects, this.audio);
    colliders.push(...this.catapults.collisionData());
    this.navigation.setObstacleDebug(colliders);
    this.learning = new LearningSystem({
      input: this.input,
      toast: (message, duration) => this.ui.toast(message, duration),
      onStorySolved: () => {
        if (this.player.health > 0 && this.fort.health > 0) this.endGame("victory");
      },
    });
    this.tower = new TowerSystem(this.player, this.input, this.ui, this.fort, this.catapults, this.projectiles, this.effects, this.audio, this.learning);
    this.setupCallbacks();
    if (this.runtime.navDebug) {
      this.navigation.toggleDebug(true);
      this.ui.setDebug(true);
    }
    this.exposeDebugAPI();
  }

  reduceDecorationsForProfile(world) {
    const keepRatio = this.performance.profile.decorationKeepRatio;
    if (keepRatio >= 1) return 0;
    const remove = [];
    world.traverse((object) => {
      if (!/Undergrowth_|ClearingDetail_/.test(object.name)) return;
      if (object.userData?.collisionRadius || object.userData?.collision) return;
      if (!shouldKeepDecoration(object.name, keepRatio)) remove.push(object);
    });
    for (const object of remove) object.parent?.remove(object);
    return remove.length;
  }

  applyPerformanceProfile(announce = false) {
    const profile = this.performance.profile;
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, profile.pixelRatio));
    this.renderer.shadowMap.enabled = profile.shadows;
    this.sun.castShadow = profile.shadows;
    this.sun.shadow.mapSize.set(profile.shadowMapSize, profile.shadowMapSize);
    this.sun.shadow.map?.dispose?.();
    this.sun.shadow.map = null;
    this.scene.fog.near = profile.fogNear;
    this.scene.fog.far = profile.fogFar;
    this.camera.far = profile.cameraFar;
    this.camera.updateProjectionMatrix();
    if (!profile.shadows && this.world) {
      this.world.traverse((object) => { if (object.isMesh) object.castShadow = false; });
    }
    this.effects?.setPerformanceProfile(profile.id);
    this.ui.setPerformanceProfile(profile, this.performance.description());
    this.resize();
    if (announce) this.ui.toast("Низкий FPS — включён режим слабого ПК", 5200);
  }

  clearCatapultPadsAndCorridors(world, pads, towerPosition) {
    world.updateMatrixWorld(true);
    const patrols = pads.map((position) => catapultArrivalEndpoints(position));
    const remove = [];
    const relocate = [];
    world.traverse((object) => {
      if (!/ForestTree_|RockCluster_|Undergrowth_/.test(object.name)) return;
      const position = object.getWorldPosition(new THREE.Vector3());
      const radius = /ForestTree_/.test(object.name) ? CONFIG.CATAPULTS.CLEAR_RADIUS : /RockCluster_/.test(object.name) ? 2.5 : 1.8;
      // Clear a narrow capsule along each patrol route instead of cutting one
      // oversized empty circle out of the forest.
      const onPad = patrols.some(({ start, end }) => distanceToSegment2D(position, start, end) < radius);
      const inShotCorridor = /ForestTree_/.test(object.name) && blocksTowerShot(position, towerPosition, pads);
      if (onPad) remove.push(object);
      else if (inShotCorridor) relocate.push({ object, position });
    });
    for (const object of remove) object.parent?.remove(object);
    for (const { object, position } of relocate) {
      const destination = relocateOffTowerShots(position, towerPosition, pads);
      object.position.copy(object.parent?.worldToLocal(destination.clone()) || destination);
    }
    world.updateMatrixWorld(true);
    this.clearedCatapultTrees = remove.filter((object) => /ForestTree_/.test(object.name)).length;
    this.relocatedCorridorTrees = relocate.length;
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
      this.learning.collectStoryFragment();
    };
    this.catapults.onDestroyed = (index, notesDropped, delay) => {
      const noteText = notesDropped > 0 ? "выпала 1 записка" : "записок больше нет";
      this.ui.toast(`Катапульта ${index + 1} разрушена — ${noteText} · подкрепление через ${Math.ceil(delay)} с`);
    };
    this.catapults.onReinforced = (index) => this.ui.toast(`Новая катапульта ${index + 1} заняла другую огневую позицию`);
    this.goblins.onBaseAttack = () => { if (Math.random() < .24) this.ui.toast("Гоблины рубят частокол"); };
  }

  bindUI() {
    const startGame = (withAudio = true) => {
      if (this.gameStarted) return;
      if (withAudio) this.audio.start();
      this.gameStarted = true;
      this.paused = false;
      this.state = "exploration";
      const selection = this.learning.configureFromMenu();
      this.ui.startGame();
      this.ui.toast(`${selection.mode === "recall" ? "Воспроизведение" : "Узнавание"} · ${selection.story.title}`, 4300);
      if (this.performance.profile.id === "low") this.ui.toast("Режим слабого ПК: облегчённый лес и быстрый рендер", 4800);
      this.learning.prepare(30).catch((error) => console.warn("Quiz preparation failed:", error));
      if (!this.runtime.dev) this.input.requestLock();
    };
    this.ui.elements.startButton.addEventListener("click", () => startGame(true));
    this.ui.elements.pause.addEventListener("click", () => this.input.requestLock());
    this.ui.elements.restart.addEventListener("click", () => location.reload());
    this.ui.elements.leaveTower.addEventListener("click", () => this.tower.leave());
    this.input.onLockChange = (locked) => {
      if (this.runtime.dev) return;
      if (!this.gameStarted || this.gameOver || this.learning?.active) return;
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
    const monitorActive = this.gameStarted && !this.gameOver && !this.paused && !this.learning?.active && !document.hidden;
    if (this.performance.observeFrame(realDt, monitorActive)) this.applyPerformanceProfile(true);
    if (!this.gameStarted || this.gameOver) {
      this.animateEnvironment(realDt);
      this.effects?.update(realDt);
      this.renderFrame();
      return;
    }
    const modalPaused = Boolean(this.learning?.active);
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
    this.renderFrame();
  }

  renderFrame() {
    const background = this.scene.background;
    const fog = this.scene.fog;
    const autoClear = this.renderer.autoClear;

    this.camera.layers.set(0);
    this.renderer.autoClear = true;
    this.renderer.render(this.scene, this.camera);

    // The first-person model gets its own depth buffer. It remains in front
    // of the world while the axe, timber, stone, palms and fingers still
    // occlude each other according to their real geometry.
    this.renderer.autoClear = false;
    this.renderer.clearDepth();
    this.scene.background = null;
    this.scene.fog = null;
    this.camera.layers.set(1);
    this.renderer.render(this.scene, this.camera);

    this.camera.layers.set(0);
    this.scene.background = background;
    this.scene.fog = fog;
    this.renderer.autoClear = autoClear;
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
      if (!this.tower.transition) this.currentInteraction = { label: this.tower.stoneReady ? "ЛКМ — бросить камень по перекрестию" : "Решить тест и получить камень", action: () => this.tower.openQuestion() };
      this.ui.setPrompt(this.currentInteraction?.label || "");
      return;
    }
    const forward = this.camera.getWorldDirection(new THREE.Vector3());
    const chopInteraction = this.chopping.nearestInteractable(this.player.position, forward);
    if (chopInteraction?.type === "tree" && !this.player.carrying) {
      const tree = chopInteraction.tree;
      const grant = this.chopping.nextQuizHitGrant(tree);
      const label = tree.hitCredits > 0
        ? `Ударить дерево · доступно ударов ${tree.hitCredits}`
        : grant > 0
          ? `Решить вопрос ${tree.correctAnswers + 1}/2 · открыть ${grant} ударов`
          : `Рубка · ${tree.hits} / ${CONFIG.CHOP.HITS}`;
      this.currentInteraction = { label, action: () => this.startChopQuestion(tree) };
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
    if (this.gameOver || this.paused || this.learning?.active) return;
    this.currentInteraction?.action?.();
  }

  async startChopQuestion(tree) {
    if (tree.hitCredits > 0) {
      this.chopping.chop(tree);
      return;
    }
    const offeredHits = this.chopping.nextQuizHitGrant(tree);
    if (!offeredHits) return;
    const correct = await this.learning.request("chop", { source: "tree", treeId: tree.id });
    if (!correct || tree.state !== "standing") {
      this.ui.toast("Ответ неверен — удары не открыты, вопрос останется в пуле");
      return;
    }
    const granted = this.chopping.grantQuizHits(tree);
    if (granted) this.ui.toast(`Верно — доступно ударов: ${granted}. Подойдите к дереву и нажимайте E`);
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
    const profile = this.performance.profile;
    this.environmentFrame = (this.environmentFrame + 1) % profile.environmentStride;
    if (this.environmentFrame !== 0) return;
    const time = this.realElapsed;
    for (const object of this.windObjects) {
      object.rotation.z = Math.sin(time * .8 + object.userData.windPhase) * .012;
    }
    for (const mesh of this.waterMeshes) {
      mesh.material.opacity = .82 + Math.sin(time * 1.15) * .018;
    }
    if (profile.id === "low") return;
    this.ambientTimer -= dt;
    if (this.ambientTimer <= 0 && this.effects) {
      this.ambientTimer = .28 + Math.random() * .25;
      const angle = Math.random() * Math.PI * 2;
      const position = this.player.position.clone().add(new THREE.Vector3(Math.cos(angle) * (4 + Math.random() * 6), 2 + Math.random() * 3, Math.sin(angle) * (4 + Math.random() * 6)));
      this.effects.spawn("wood", position, new THREE.Vector3((Math.random() - .5) * .2, -.12, (Math.random() - .5) * .2), 3.5, .35, -.02);
    }
  }

  objective() {
    if (this.fort.stage < 3) return { title: "Постройте крепость", text: "Первый верный ответ открывает два удара. Второй — все оставшиеся удары до падения дерева." };
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
    this.ui.setChopProgress(this.chopping.progress());
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
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, this.performance.profile.pixelRatio));
    this.renderer.setSize(innerWidth, innerHeight);
  }

  exposeDebugAPI() {
    window.__waldwacht = {
      game: this,
      snapshot: () => ({
        state: this.state, elapsed: this.elapsed, player: { health: this.player.health, position: this.player.position.toArray() },
        base: { stage: this.fort.stage, health: this.fort.health, gate: this.fort.gateState },
        notes: this.notes.collected, attack: this.attackActive, learning: this.learning.snapshot(),
        render: {
          performanceProfile: this.performance.profile.id,
          performanceReason: this.performance.reason,
          measuredFps: Math.round(this.performance.measuredFps || this.fps),
          calls: this.renderer.info.render.calls,
          triangles: this.renderer.info.render.triangles,
          textures: this.renderer.info.memory.textures,
          geometries: this.renderer.info.memory.geometries,
          pixelRatio: this.renderer.getPixelRatio(),
          instancedDrawCallsSaved: this.world?.userData?.drawCallsSaved || 0,
          removedLowEndDecorations: this.removedLowEndDecorations || 0,
        },
        goblins: this.goblins.agents.map((agent) => ({ state: agent.state, path: agent.path.length, position: agent.object.position.toArray() })),
        catapults: this.catapults.catapults.map((catapult) => ({
          health: catapult.health,
          destroyed: catapult.destroyedState,
          generation: catapult.generation,
          state: catapult.state,
          position: catapult.position.toArray(),
        })),
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
