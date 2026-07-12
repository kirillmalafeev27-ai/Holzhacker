import { CONFIG, getRuntimeConfig } from './config.js';
import { QuestionDeck } from './questions.js';

const TAU = Math.PI * 2;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const lerp = (a, b, t) => a + (b - a) * t;
const easeOut = (t) => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const wrapAngle = (angle) => Math.atan2(Math.sin(angle), Math.cos(angle));

function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

class AssetLoader {
  constructor(onProgress) {
    this.onProgress = onProgress;
    this.images = new Map();
  }

  async load(manifest) {
    const entries = Object.entries(manifest);
    let completed = 0;
    await Promise.all(entries.map(([name, src]) => new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => {
        this.images.set(name, image);
        completed += 1;
        this.onProgress?.(completed / entries.length);
        resolve();
      };
      image.onerror = () => reject(new Error(`Не удалось загрузить ${src}`));
      image.src = src;
    })));
    return this.images;
  }
}

class ForestDefenseGame {
  constructor(canvas, assets) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.assets = assets;
    this.runtime = getRuntimeConfig();
    this.deck = new QuestionDeck();
    this.keys = new Set();
    this.lastTime = performance.now();
    this.elapsed = 0;
    this.realElapsed = 0;
    this.gameState = 'exploration';
    this.gameOver = false;
    this.attackActive = false;
    this.attackWarning30 = false;
    this.attackWarning10 = false;
    this.logsDelivered = 0;
    this.base = { stage: 0, health: CONFIG.BASE_MAX_HEALTH, maxHealth: CONFIG.BASE_MAX_HEALTH };
    this.player = {
      x: 0, z: -15, y: 0, vx: 0, vz: 0, radius: CONFIG.PLAYER_RADIUS,
      health: CONFIG.PLAYER_MAX_HEALTH, invulnerability: 0, dodgeTimer: 0,
      carrying: false, atTower: false, stoneReady: false, facingX: 0.7, facingZ: 0.7,
      axeSwing: 0, hitFlash: 0,
    };
    this.camera = { x: 0, z: 0, y: 0 };
    this.currentInteraction = null;
    this.question = null;
    this.toastTimer = 0;
    this.warningTimer = 0;
    this.demoEvents = new Set();
    this.noteCount = 0;
    this.particles = [];
    this.projectiles = [];
    this.stones = [];
    this.notes = [];
    this.groundLogs = [];
    this.groundDetails = [];
    this.nature = [];
    this.colliders = [];
    this.trees = [];
    this.goblins = [];
    this.catapults = [];
    this.resize();
    this.buildWorld();
    this.bindInput();
    this.bindUI();
    this.updateUI();
    this.exposeDebugAPI();
  }

  buildWorld() {
    const rng = seededRandom(112358);
    const pineSprites = ['treePine', 'treePineSmall'];
    let id = 0;
    for (const [radius, count] of [[29, 24], [35, 32]]) {
      for (let i = 0; i < count; i += 1) {
        const angle = i / count * TAU + (radius > 32 ? 0.09 : 0);
        const normalized = wrapAngle(angle);
        if (normalized > -1.83 && normalized < -1.32) continue;
        const r = radius + (rng() - 0.5) * 3.2;
        this.nature.push({
          id: `pine-${id++}`, type: pineSprites[id % 2], x: Math.cos(angle) * r, z: Math.sin(angle) * r,
          scale: 0.85 + rng() * 0.45, anchor: 'bottom', sortBias: 0,
        });
      }
    }

    const rockPositions = [[-24,-17,1.25],[25,-15,1.1],[-29,4,.9],[28,12,1.2],[-14,26,.95],[16,27,1.1],[7,-28,.85]];
    rockPositions.forEach(([x,z,scale], index) => {
      this.nature.push({ id:`rock-${index}`, type:index % 2 ? 'rockSmall':'rockLarge', x,z,scale, anchor:'bottom', sortBias:.02 });
      this.colliders.push({ x, z, radius: 1.2 * scale, kind: 'rock' });
    });
    for (let i = 0; i < 38; i += 1) {
      const angle = rng() * TAU;
      const radius = 20 + rng() * 8;
      this.nature.push({ id:`grass-${i}`, type:'grass', x:Math.cos(angle)*radius, z:Math.sin(angle)*radius, scale:.58+rng()*.55, anchor:'bottom', sortBias:-.02 });
    }
    [[-27,-23],[26,-22],[-31,18]].forEach(([x,z], index) => {
      this.nature.push({ id:`log-stack-${index}`, type:'logStack', x,z,scale:.82,anchor:'bottom',sortBias:.01 });
    });

    const treePositions = [[-17,-9],[17,-10],[21,8],[-21,11],[12,18]];
    treePositions.forEach(([x,z], index) => {
      const tree = { id:`tree-${index}`, x,z,hits:0,state:'standing',chopTimer:0,fallTimer:0,hitApplied:false };
      this.trees.push(tree);
      this.colliders.push({ x,z,radius:1.1,kind:'tree',ref:tree });
    });

    const detailRng = seededRandom(90210);
    for (let i = 0; i < 310; i += 1) {
      const angle = detailRng() * TAU;
      const radius = Math.sqrt(detailRng()) * 37;
      this.groundDetails.push({
        x: Math.cos(angle)*radius, z:Math.sin(angle)*radius,
        kind: detailRng() > .82 ? 'flower' : detailRng() > .58 ? 'blade' : 'stone',
        hue: detailRng(), size:.5+detailRng(),
      });
    }

    const catapultPositions = [[-27,14],[28,13],[3,31]];
    catapultPositions.forEach(([x,z], index) => {
      this.catapults.push({
        id:`catapult-${index}`, x,z,health:CONFIG.CATAPULT_HITS_TO_DESTROY,
        destroyed:false, recoil:0, hitFlash:0,
        nextFire: CONFIG.CATAPULT_FIRE_INTERVAL_MIN + index * 1.7 + rng()*2,
      });
    });
  }

  bindInput() {
    window.addEventListener('keydown', (event) => {
      if (['KeyW','KeyA','KeyS','KeyD','ShiftLeft','ShiftRight','Space'].includes(event.code)) event.preventDefault();
      this.keys.add(event.code);
      if (event.repeat || this.gameOver) return;
      if (this.question && /^Digit[123]$/.test(event.code)) {
        const option = this.question.options[Number(event.code.slice(-1)) - 1];
        if (option) this.answerQuestion(option);
        return;
      }
      if (event.code === 'KeyE') this.interact();
      if (event.code === 'Space') this.startDodge();
      if (event.code === 'KeyX' && this.player.atTower) this.leaveTower();
      if (/^Digit[123]$/.test(event.code) && this.player.stoneReady) this.throwStone(Number(event.code.slice(-1)) - 1);
    });
    window.addEventListener('keyup', (event) => this.keys.delete(event.code));
    window.addEventListener('resize', () => this.resize());
  }

  bindUI() {
    document.getElementById('restart-button').addEventListener('click', () => location.reload());
    document.querySelectorAll('[data-dev]').forEach((button) => {
      button.addEventListener('click', () => this.runDevAction(button.dataset.dev));
    });
    if (this.runtime.dev) document.getElementById('dev-panel').classList.remove('hidden');
  }

  resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    this.width = innerWidth;
    this.height = innerHeight;
    this.dpr = dpr;
    this.canvas.width = Math.round(this.width * dpr);
    this.canvas.height = Math.round(this.height * dpr);
    this.ctx.setTransform(dpr,0,0,dpr,0,0);
    this.unit = Math.min(this.width / 1280, this.height / 720);
    this.isoX = 12.3 * this.unit;
    this.isoY = 6.15 * this.unit;
    this.isoH = 13.5 * this.unit;
  }

  project(x, z, y = 0) {
    const rx = x - this.camera.x;
    const rz = z - this.camera.z;
    return {
      x: this.width * .5 + (rx - rz) * this.isoX,
      y: this.height * .43 + (rx + rz) * this.isoY - (y - this.camera.y) * this.isoH,
    };
  }

  unprojectScreenDirection(dx, dy) {
    return { x: dx + dy, z: dy - dx };
  }

  start() {
    document.getElementById('loading').classList.add('hidden');
    document.getElementById('hud').classList.remove('hidden');
    this.lastTime = performance.now();
    requestAnimationFrame((time) => this.loop(time));
  }

  loop(time) {
    const realDt = Math.min((time - this.lastTime) / 1000, .05);
    this.lastTime = time;
    this.realElapsed += realDt;
    if (this.runtime.demo) this.updateDemo(realDt);
    const simulationPaused = this.question !== null || this.gameOver;
    if (!simulationPaused) this.update(realDt);
    this.render();
    requestAnimationFrame((next) => this.loop(next));
  }

  update(realDt) {
    const dt = realDt * this.runtime.timeScale;
    this.elapsed += dt;
    this.toastTimer = Math.max(0, this.toastTimer - realDt);
    this.warningTimer = Math.max(0, this.warningTimer - realDt);
    this.player.invulnerability = Math.max(0, this.player.invulnerability - realDt);
    this.player.hitFlash = Math.max(0, this.player.hitFlash - realDt);
    this.player.axeSwing = Math.max(0, this.player.axeSwing - realDt);
    this.updateAttackTimer();
    this.updatePlayer(realDt);
    this.updateTrees(realDt);
    this.updateGoblins(dt);
    this.updateCatapults(dt);
    this.updateProjectiles(realDt);
    this.updateParticles(realDt);
    this.collectNearbyNotes();
    this.updateCamera(realDt);
    this.findInteraction();
    this.updateUI();
  }

  updateAttackTimer() {
    const remaining = CONFIG.ATTACK_START_TIME - this.elapsed;
    if (!this.attackWarning30 && remaining <= 30 && remaining > 10) {
      this.attackWarning30 = true;
      this.showWarning('До нападения 30 секунд', 3);
    }
    if (!this.attackWarning10 && remaining <= 10 && remaining > 0) {
      this.attackWarning10 = true;
      this.showWarning('Враг уже близко!', 4);
    }
    if (!this.attackActive && remaining <= 0) this.activateAttack();
  }

  updatePlayer(dt) {
    if (this.player.atTower) return;
    let sx = 0, sy = 0;
    if (this.keys.has('KeyW')) sy -= 1;
    if (this.keys.has('KeyS')) sy += 1;
    if (this.keys.has('KeyA')) sx -= 1;
    if (this.keys.has('KeyD')) sx += 1;
    const world = this.unprojectScreenDirection(sx, sy);
    const length = Math.hypot(world.x, world.z) || 1;
    let speed = CONFIG.PLAYER_SPEED;
    if (this.keys.has('ShiftLeft') || this.keys.has('ShiftRight')) speed *= CONFIG.PLAYER_RUN_MULTIPLIER;
    if (this.player.carrying) speed *= CONFIG.CARRY_SPEED_MULTIPLIER;
    if (this.player.dodgeTimer > 0) {
      this.player.dodgeTimer -= dt;
      speed = CONFIG.PLAYER_DODGE_SPEED;
    }
    const moving = sx !== 0 || sy !== 0;
    const dirX = moving ? world.x / length : this.player.facingX;
    const dirZ = moving ? world.z / length : this.player.facingZ;
    if (moving) {
      this.player.facingX = dirX;
      this.player.facingZ = dirZ;
    }
    this.player.vx = moving || this.player.dodgeTimer > 0 ? dirX * speed : 0;
    this.player.vz = moving || this.player.dodgeTimer > 0 ? dirZ * speed : 0;
    let nx = this.player.x + this.player.vx * dt;
    let nz = this.player.z + this.player.vz * dt;
    const worldRadius = Math.hypot(nx, nz);
    if (worldRadius > CONFIG.WORLD_RADIUS) {
      nx *= CONFIG.WORLD_RADIUS / worldRadius;
      nz *= CONFIG.WORLD_RADIUS / worldRadius;
    }
    ({ x: nx, z: nz } = this.resolveWorldCollision(nx, nz));
    this.player.x = nx;
    this.player.z = nz;
  }

  resolveWorldCollision(nx, nz) {
    const oldRadius = Math.hypot(this.player.x, this.player.z);
    const newRadius = Math.hypot(nx, nz);
    if (this.base.stage === 3 && ((oldRadius < 9.4 && newRadius >= 9.4) || (oldRadius > 10.2 && newRadius <= 10.2))) {
      const throughGate = Math.abs(nx) < 2.2 && nz < -7.5;
      if (!throughGate) return { x: this.player.x, z: this.player.z };
    }
    for (const collider of this.colliders) {
      if (collider.kind === 'tree' && collider.ref.state !== 'standing') continue;
      const dx = nx - collider.x;
      const dz = nz - collider.z;
      const minimum = collider.radius + this.player.radius;
      const length = Math.hypot(dx,dz);
      if (length > 0 && length < minimum) {
        nx = collider.x + dx / length * minimum;
        nz = collider.z + dz / length * minimum;
      }
    }
    return { x:nx, z:nz };
  }

  startDodge() {
    if (this.question || this.player.atTower || this.player.dodgeTimer > 0) return;
    this.player.dodgeTimer = CONFIG.PLAYER_DODGE_DURATION;
    this.player.invulnerability = Math.max(this.player.invulnerability, .45);
  }

  updateTrees(dt) {
    for (const tree of this.trees) {
      if (tree.chopTimer > 0) {
        tree.chopTimer -= dt;
        if (!tree.hitApplied && tree.chopTimer <= CONFIG.CHOP_DURATION * .48) {
          tree.hitApplied = true;
          tree.hits += 1;
          this.spawnWoodBurst(tree.x, tree.z);
          if (tree.hits >= CONFIG.TREE_HITS_REQUIRED) {
            tree.state = 'falling';
            tree.fallTimer = 1.05;
            this.showToast('Последний удар — дерево падает!');
          }
        }
      }
      if (tree.state === 'falling') {
        tree.fallTimer -= dt;
        if (tree.fallTimer <= 0) {
          tree.state = 'fallen';
          this.groundLogs.push({ id:`log-${tree.id}`, x:tree.x+1.3, z:tree.z+.8, collected:false });
          this.showToast('Бревно готово — поднимите его');
        }
      }
    }
  }

  startChop(tree) {
    if (tree.state !== 'standing' || tree.chopTimer > 0 || this.player.carrying) return;
    tree.chopTimer = CONFIG.CHOP_DURATION;
    tree.hitApplied = false;
    this.player.axeSwing = CONFIG.CHOP_DURATION;
    this.gameState = 'exploration';
    this.showToast(`Удар ${Math.min(tree.hits + 1, 4)} / 4`);
  }

  spawnWoodBurst(x, z) {
    for (let i = 0; i < 10; i += 1) {
      const angle = Math.PI * (.7 + Math.random() * .7);
      this.particles.push({
        kind: i < 5 ? 'chip' : 'spark', x, z, y:1.1,
        vx:Math.cos(angle)*(1.8+Math.random()*3), vz:(Math.random()-.5)*3,
        vy:2.5+Math.random()*3.5, life:.55+Math.random()*.35,
      });
    }
  }

  updateParticles(dt) {
    for (const particle of this.particles) {
      particle.life -= dt;
      particle.x += particle.vx * dt;
      particle.z += particle.vz * dt;
      particle.y += particle.vy * dt;
      particle.vy -= 9 * dt;
    }
    this.particles = this.particles.filter((particle) => particle.life > 0);
  }

  findInteraction() {
    this.currentInteraction = null;
    if (this.player.atTower) {
      this.currentInteraction = { label:'E — немецкое задание для броска · X — спуститься', action:() => this.openQuestion() };
      return;
    }
    if (this.player.carrying) {
      const distCenter = Math.hypot(this.player.x, this.player.z);
      if (this.base.stage < 3 && distCenter < 6.5) {
        this.currentInteraction = { label:'E — передать древесину строителям', action:() => this.deliverLog() };
        return;
      }
      if (this.base.stage === 3 && Math.hypot(this.player.x, this.player.z + 8.2) < 3.2) {
        this.currentInteraction = { label:'E — использовать бревно для ремонта', action:() => this.repairBase() };
        return;
      }
    }
    if (!this.player.carrying) {
      const log = this.groundLogs.find((item) => !item.collected && distance(this.player, item) < CONFIG.INTERACTION_RADIUS);
      if (log) {
        this.currentInteraction = { label:'E — поднять бревно', action:() => this.pickupLog(log) };
        return;
      }
      const tree = this.trees.find((item) => item.state === 'standing' && distance(this.player,item) < CONFIG.INTERACTION_RADIUS);
      if (tree) {
        this.currentInteraction = { label:`E — рубить дерево (${tree.hits}/4)`, action:() => this.startChop(tree) };
        return;
      }
    }
    if (this.base.stage === 3 && Math.hypot(this.player.x - 4.8, this.player.z - 4) < 2.6) {
      this.currentInteraction = { label:'E — подняться на оборонительную башню', action:() => this.enterTower() };
    }
  }

  interact() {
    if (this.question || this.gameOver) return;
    this.currentInteraction?.action?.();
  }

  pickupLog(log) {
    if (this.player.carrying) return;
    log.collected = true;
    this.player.carrying = true;
    this.gameState = 'carryingLog';
    this.showToast('Бревно поднято — скорость снижена');
  }

  deliverLog() {
    if (!this.player.carrying || this.base.stage >= 3) return;
    this.player.carrying = false;
    this.logsDelivered += 1;
    this.base.stage = Math.min(3, this.logsDelivered);
    this.gameState = this.base.stage === 3 ? (this.attackActive ? 'defenseActive' : 'exploration') : 'buildingBase';
    if (this.base.stage === 3) {
      this.showToast('Крепость готова! Башня и ремонт активированы');
    } else {
      this.showToast(`Строительство: ${this.base.stage} / 3`);
    }
  }

  repairBase() {
    if (!this.player.carrying) return;
    if (this.base.health >= this.base.maxHealth) {
      this.showToast('Крепость не нуждается в ремонте');
      return;
    }
    this.player.carrying = false;
    const before = this.base.health;
    this.base.health = Math.min(this.base.maxHealth, this.base.health + CONFIG.REPAIR_PER_LOG);
    this.spawnRepairEffect();
    this.showToast(`Ремонт +${this.base.health - before}`);
  }

  spawnRepairEffect() {
    for (let i=0;i<16;i+=1) {
      const angle = Math.random()*TAU;
      this.particles.push({kind:'repair',x:Math.cos(angle)*9,z:Math.sin(angle)*9,y:1,
        vx:(Math.random()-.5),vz:(Math.random()-.5),vy:1+Math.random()*2,life:1});
    }
  }

  activateAttack() {
    if (this.attackActive || this.gameOver) return;
    this.attackActive = true;
    this.gameState = 'defenseActive';
    this.showWarning('НАПАДЕНИЕ НАЧАЛОСЬ', 5);
    const spawns = [[-30,0],[25,17],[25,-18],[-24,-19],[-18,25],[18,26]];
    this.goblins = spawns.slice(0,CONFIG.GOBLIN_COUNT).map(([x,z], index) => ({
      id:`goblin-${index}`,x,z,state:'approach',attackTimer:Math.random(),hitFlash:0,phase:index*.8,
    }));
    this.catapults.forEach((catapult,index) => {
      catapult.nextFire = 1.8 + index * 1.5;
    });
  }

  updateGoblins(dt) {
    if (!this.attackActive || this.gameOver) return;
    for (const goblin of this.goblins) {
      goblin.hitFlash = Math.max(0,goblin.hitFlash-dt);
      goblin.phase += dt*5;
      const radius = Math.hypot(goblin.x,goblin.z);
      if (goblin.state === 'approach') {
        const stopRadius = this.base.stage === 3 ? 10.4 : 3.2;
        if (radius > stopRadius) {
          const nx = -goblin.x/radius, nz=-goblin.z/radius;
          goblin.x += nx*CONFIG.GOBLIN_SPEED*dt;
          goblin.z += nz*CONFIG.GOBLIN_SPEED*dt;
        } else {
          goblin.state='attack';
          goblin.attackTimer=.4;
        }
      } else if (goblin.state === 'attack') {
        goblin.attackTimer -= dt;
        if (goblin.attackTimer <= 0) {
          goblin.attackTimer = CONFIG.GOBLIN_ATTACK_INTERVAL;
          this.damageBase(CONFIG.GOBLIN_ATTACK_DAMAGE,'Гоблины атакуют частокол');
        }
      }
    }
  }

  updateCatapults(dt) {
    for (const catapult of this.catapults) {
      catapult.recoil = Math.max(0,catapult.recoil-dt*2.4);
      catapult.hitFlash = Math.max(0,catapult.hitFlash-dt);
      if (!this.attackActive || catapult.destroyed || this.gameOver) continue;
      catapult.nextFire -= dt;
      if (catapult.nextFire <= 0) {
        this.fireCatapult(catapult);
        catapult.nextFire = CONFIG.CATAPULT_FIRE_INTERVAL_MIN + Math.random()*(CONFIG.CATAPULT_FIRE_INTERVAL_MAX-CONFIG.CATAPULT_FIRE_INTERVAL_MIN);
      }
    }
  }

  fireCatapult(catapult) {
    catapult.recoil = 1;
    const playerOutside = Math.hypot(this.player.x,this.player.z) > CONFIG.FORT_RADIUS + 1 && !this.player.atTower;
    const aimAtPlayer = playerOutside && Math.random() < .58;
    let target;
    if (aimAtPlayer) {
      target = {
        x:this.player.x+this.player.vx*.5+(Math.random()-.5)*1.8,
        z:this.player.z+this.player.vz*.5+(Math.random()-.5)*1.8,
      };
    } else {
      const angle=Math.random()*TAU;
      target={x:Math.cos(angle)*7.8,z:Math.sin(angle)*7.8};
    }
    this.projectiles.push({
      kind:'catapult',start:{x:catapult.x,z:catapult.z,y:2.0},target,
      x:catapult.x,z:catapult.z,y:2,age:0,duration:CONFIG.PROJECTILE_FLIGHT_TIME,
      targetPlayer:aimAtPlayer,active:true,
    });
  }

  updateProjectiles(dt) {
    for (const projectile of this.projectiles) {
      if (!projectile.active) continue;
      projectile.age += dt;
      const t=clamp(projectile.age/projectile.duration,0,1);
      projectile.x=lerp(projectile.start.x,projectile.target.x,t);
      projectile.z=lerp(projectile.start.z,projectile.target.z,t);
      projectile.y=lerp(projectile.start.y,0.2,t)+Math.sin(Math.PI*t)*8.5;
      if (t>=1) {
        projectile.active=false;
        this.impactCatapultProjectile(projectile);
      }
    }
    this.projectiles=this.projectiles.filter((projectile)=>projectile.active);

    for (const stone of this.stones) {
      if (!stone.active) continue;
      stone.age+=dt;
      const t=clamp(stone.age/stone.duration,0,1);
      stone.x=lerp(stone.start.x,stone.target.x,t);
      stone.z=lerp(stone.start.z,stone.target.z,t);
      stone.y=lerp(stone.start.y,1,t)+Math.sin(Math.PI*t)*9.5;
      if (t>=1) {
        stone.active=false;
        this.hitCatapult(stone.catapult);
      }
    }
    this.stones=this.stones.filter((stone)=>stone.active);
  }

  impactCatapultProjectile(projectile) {
    this.spawnImpact(projectile.target.x,projectile.target.z,'dust');
    if (projectile.targetPlayer) {
      if (Math.hypot(this.player.x-projectile.target.x,this.player.z-projectile.target.z)<1.65) this.damagePlayer();
      else this.showToast('Уклонение удалось');
    } else {
      this.damageBase(CONFIG.CATAPULT_BASE_DAMAGE,'Попадание катапульты');
    }
  }

  spawnImpact(x,z,kind='dust') {
    for(let i=0;i<14;i+=1){
      const angle=Math.random()*TAU;
      this.particles.push({kind,x,z,y:.2,vx:Math.cos(angle)*(1+Math.random()*2),vz:Math.sin(angle)*(1+Math.random()*2),vy:1+Math.random()*3,life:.7+Math.random()*.5});
    }
  }

  damagePlayer() {
    if (this.player.invulnerability>0 || this.gameOver) return;
    this.player.health-=1;
    this.player.invulnerability=CONFIG.PLAYER_HIT_INVULNERABILITY;
    this.player.hitFlash=.55;
    this.player.x-=this.player.facingX*1.2;
    this.player.z-=this.player.facingZ*1.2;
    this.showWarning('Игрок ранен!',2);
    if(this.player.health<=0) this.endGame('player');
  }

  damageBase(amount,message='Крепость получает урон') {
    if(this.gameOver) return;
    this.base.health=Math.max(0,this.base.health-amount);
    if(Math.random()<.35) this.showToast(message);
    if(this.base.health<=0) this.endGame('base');
  }

  enterTower() {
    if(this.base.stage<3) return;
    this.player.atTower=true;
    this.player.carrying=false;
    this.player.x=4.8; this.player.z=4; this.player.y=7;
    this.gameState='towerInteraction';
    this.showToast('Башня: E — задание, X — спуститься');
  }

  leaveTower() {
    this.player.atTower=false;
    this.player.y=0;
    this.player.x=4.8; this.player.z=6.4;
    this.player.stoneReady=false;
    this.gameState=this.attackActive?'defenseActive':'exploration';
  }

  openQuestion() {
    if(!this.player.atTower || this.question || this.player.stoneReady) {
      if(this.player.stoneReady) this.showToast('Выберите катапульту клавишей 1, 2 или 3');
      return;
    }
    this.question=this.deck.next();
    this.gameState='questionActive';
    this.renderQuestion();
  }

  renderQuestion() {
    const modal=document.getElementById('question-modal');
    const prompt=document.getElementById('question-prompt');
    const options=document.getElementById('question-options');
    const feedback=document.getElementById('question-feedback');
    prompt.textContent=this.question.prompt;
    feedback.textContent=''; feedback.className='question-feedback';
    options.innerHTML='';
    this.question.options.forEach((option,index)=>{
      const button=document.createElement('button');
      button.type='button';
      button.textContent=`${index+1}. ${option}`;
      button.addEventListener('click',()=>this.answerQuestion(option));
      options.appendChild(button);
    });
    modal.classList.remove('hidden');
  }

  answerQuestion(option) {
    if(!this.question) return false;
    const feedback=document.getElementById('question-feedback');
    const correct=option===this.question.answer;
    if(correct){
      feedback.textContent='Richtig! Один бросок разрешён.';
      feedback.className='question-feedback';
      this.player.stoneReady=true;
      setTimeout(()=>{
        document.getElementById('question-modal').classList.add('hidden');
        this.question=null;
        this.gameState='stoneThrowReady';
        this.showToast('Выберите цель: клавиши 1, 2 или 3');
      },650);
    }else{
      feedback.textContent='Nicht richtig. Камень сохранён — попробуйте ещё раз.';
      feedback.className='question-feedback error';
      document.querySelectorAll('#question-options button').forEach((button)=>button.disabled=true);
      setTimeout(()=>{ if(this.question){ this.question=this.deck.next(); this.renderQuestion(); } },850);
    }
    return correct;
  }

  throwStone(index) {
    const catapult=this.catapults[index];
    if(!this.player.atTower || !this.player.stoneReady || !catapult || catapult.destroyed) {
      this.showToast(catapult?.destroyed?'Эта катапульта уже разрушена':'Бросок недоступен');
      return;
    }
    this.player.stoneReady=false;
    this.gameState='towerInteraction';
    this.stones.push({
      active:true,age:0,duration:2.15,
      start:{x:4.8,z:4,y:7.6},target:{x:catapult.x,z:catapult.z},
      x:4.8,z:4,y:7.6,catapult,
    });
    this.showToast(`Камень летит в катапульту ${index+1}`);
  }

  hitCatapult(catapult) {
    if(catapult.destroyed) return;
    catapult.health-=1;
    catapult.hitFlash=.6;
    this.spawnImpact(catapult.x,catapult.z,'chip');
    if(catapult.health<=0) this.destroyCatapult(catapult);
    else this.showToast('Попадание! Требуется ещё один камень');
  }

  destroyCatapult(catapult) {
    if(catapult.destroyed) return;
    catapult.destroyed=true;
    catapult.recoil=1;
    this.showToast('Катапульта разрушена — выпали записки');
    for(let i=0;i<2;i+=1){
      this.notes.push({id:`note-${catapult.id}-${i}`,x:catapult.x+(i?1.2:-1.2),z:catapult.z+(i?-.5:.6),collected:false,float:i*.9});
    }
  }

  collectNearbyNotes() {
    for(const note of this.notes){
      note.float+=.03;
      if(!note.collected && !this.player.atTower && distance(this.player,note)<CONFIG.NOTE_PICKUP_RADIUS){
        note.collected=true;
        this.noteCount+=1;
        this.showToast(`Записка найдена: ${this.noteCount} / ${CONFIG.TOTAL_NOTES}`);
        if(this.noteCount>=CONFIG.TOTAL_NOTES && this.player.health>0 && this.base.health>0) this.endGame('victory');
      }
    }
  }

  endGame(reason) {
    if(this.gameOver) return;
    this.gameOver=true;
    this.attackActive=false;
    this.gameState=reason==='victory'?'victory':reason==='player'?'playerDefeated':'baseDestroyed';
    this.projectiles=[];
    const title=document.getElementById('end-title');
    const message=document.getElementById('end-message');
    const crest=document.getElementById('end-crest');
    if(reason==='victory'){
      title.textContent='Победа'; crest.textContent='✓';
      message.textContent=`Все ${this.noteCount} записок собраны. Крепость и её защитник выстояли.`;
    }else if(reason==='player'){
      title.textContent='Поражение'; crest.textContent='×';
      message.textContent='Защитник получил третье попадание. Враги захватили поляну.';
    }else{
      title.textContent='Крепость разрушена'; crest.textContent='×';
      message.textContent='Прочность частокола упала до нуля. Строительство нужно начать заново.';
    }
    document.getElementById('end-screen').classList.remove('hidden');
  }

  updateCamera(dt) {
    const targetX=this.player.atTower?2:this.player.x*.18;
    const targetZ=this.player.atTower?1:this.player.z*.18;
    this.camera.x=lerp(this.camera.x,targetX,1-Math.exp(-dt*2.2));
    this.camera.z=lerp(this.camera.z,targetZ,1-Math.exp(-dt*2.2));
    this.camera.y=lerp(this.camera.y,this.player.atTower?1.8:0,1-Math.exp(-dt*2));
  }

  showToast(text,duration=2.4) {
    const element=document.getElementById('toast');
    element.textContent=text;
    element.classList.remove('hidden');
    this.toastTimer=duration;
    clearTimeout(this.toastTimeout);
    this.toastTimeout=setTimeout(()=>element.classList.add('hidden'),duration*1000);
  }

  showWarning(text,duration=3) {
    const element=document.getElementById('warning');
    element.textContent=text;
    element.classList.remove('hidden');
    this.warningTimer=duration;
    clearTimeout(this.warningTimeout);
    this.warningTimeout=setTimeout(()=>element.classList.add('hidden'),duration*1000);
  }

  updateUI() {
    const hearts=document.getElementById('player-hearts');
    hearts.innerHTML='';
    for(let i=0;i<CONFIG.PLAYER_MAX_HEALTH;i+=1){const span=document.createElement('span');span.className=`heart${i>=this.player.health?' empty':''}`;hearts.appendChild(span);}
    document.getElementById('base-health-text').textContent=`${Math.ceil(this.base.health)} / ${this.base.maxHealth}`;
    document.getElementById('base-health-bar').style.width=`${this.base.health/this.base.maxHealth*100}%`;
    const remaining=Math.max(0,Math.ceil(CONFIG.ATTACK_START_TIME-this.elapsed));
    document.getElementById('attack-timer').textContent=this.attackActive?'ИДЁТ БОЙ':`${String(Math.floor(remaining/60)).padStart(2,'0')}:${String(remaining%60).padStart(2,'0')}`;
    document.getElementById('logs-count').textContent=`${this.logsDelivered} / ${CONFIG.TOTAL_BUILD_LOGS}`;
    document.getElementById('build-stage').textContent=`${this.base.stage} / 3`;
    document.getElementById('notes-count').textContent=`${this.noteCount} / ${CONFIG.TOTAL_NOTES}`;
    document.getElementById('carry-state').textContent=this.player.carrying?'Несёт древесину':'Руки свободны';
    const objectiveTitle=document.getElementById('objective-title');
    const objectiveText=document.getElementById('objective-text');
    if(this.base.stage<3){objectiveTitle.textContent='Постройте крепость';objectiveText.textContent='Срубите и доставьте три дерева в центр поляны.';}
    else if(!this.attackActive){objectiveTitle.textContent='Подготовьтесь к нападению';objectiveText.textContent='Башня готова. Заготавливайте древесину для будущего ремонта.';}
    else if(this.noteCount<CONFIG.TOTAL_NOTES){objectiveTitle.textContent='Защитите Waldwacht';objectiveText.textContent='Используйте башню, разрушьте катапульты и соберите шесть записок.';}
    const prompt=document.getElementById('interaction-prompt');
    if(this.currentInteraction){prompt.textContent=this.currentInteraction.label;prompt.classList.remove('hidden');}else prompt.classList.add('hidden');
  }

  drawSprite(item) {
    const image=this.assets.get(item.type);
    if(!image) return;
    const point=this.project(item.x,item.z,item.y||0);
    const sizes={treePine:[122,184],treePineSmall:[95,142],treeOak:[165,190],treeStage0:[176,205],treeStage25:[176,205],treeStage50:[176,205],treeStage75:[176,205],treeStage90:[176,205],treeFallen:[220,145],stump:[64,55],rockLarge:[118,88],rockSmall:[70,54],grass:[54,45],log:[82,52],logStack:[100,70],fence:[92,74],gate:[102,72],tent:[118,95],campfire:[58,45],pot:[44,40]};
    const [baseW,baseH]=sizes[item.type]||[80,80];
    const scale=(item.scale||1)*this.unit;
    const w=baseW*scale,h=baseH*scale;
    this.ctx.save();
    this.ctx.globalAlpha=item.opacity??1;
    this.ctx.translate(point.x,point.y);
    if(item.rotation) this.ctx.rotate(item.rotation);
    this.ctx.drawImage(image,-w/2,-h,w,h);
    this.ctx.restore();
  }

  render() {
    const ctx=this.ctx;
    ctx.setTransform(this.dpr,0,0,this.dpr,0,0);
    const sky=ctx.createLinearGradient(0,0,0,this.height);
    sky.addColorStop(0,'#87967a'); sky.addColorStop(.24,'#667e57'); sky.addColorStop(1,'#263c2b');
    ctx.fillStyle=sky;ctx.fillRect(0,0,this.width,this.height);
    this.drawTerrain();

    const drawables=[];
    for(const item of this.nature) drawables.push({key:item.x+item.z+(item.sortBias||0),draw:()=>this.drawSprite(item)});
    for(const tree of this.trees) drawables.push({key:tree.x+tree.z+.08,draw:()=>this.drawTree(tree)});
    for(const log of this.groundLogs) if(!log.collected) drawables.push({key:log.x+log.z+.04,draw:()=>this.drawSprite({type:'log',x:log.x,z:log.z,scale:.75})});
    this.addFortDrawables(drawables);
    for(const catapult of this.catapults) drawables.push({key:catapult.x+catapult.z+.12,draw:()=>this.drawCatapult(catapult)});
    for(const goblin of this.goblins) drawables.push({key:goblin.x+goblin.z+.16,draw:()=>this.drawGoblin(goblin)});
    for(const note of this.notes) if(!note.collected) drawables.push({key:note.x+note.z+.22,draw:()=>this.drawNote(note)});
    drawables.push({key:this.player.x+this.player.z+.25,draw:()=>this.drawPlayer()});
    drawables.sort((a,b)=>a.key-b.key);
    drawables.forEach((entry)=>entry.draw());

    this.drawProjectiles();
    this.drawParticles();
    this.drawVignette();
  }

  drawTerrain() {
    const ctx=this.ctx;
    const terrain=[];
    for(let i=0;i<64;i+=1){const a=i/64*TAU;terrain.push(this.project(Math.cos(a)*42,Math.sin(a)*42,0));}
    ctx.beginPath();terrain.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();
    const ground=ctx.createLinearGradient(0,this.height*.2,this.width,this.height);
    ground.addColorStop(0,'#577837');ground.addColorStop(.55,'#78933d');ground.addColorStop(1,'#3e6433');ctx.fillStyle=ground;ctx.fill();
    const clearing=[];for(let i=0;i<64;i+=1){const a=i/64*TAU;clearing.push(this.project(Math.cos(a)*21,Math.sin(a)*18.5,.01));}
    ctx.beginPath();clearing.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();
    const dirt=ctx.createRadialGradient(this.width*.52,this.height*.48,20,this.width*.52,this.height*.48,this.width*.45);
    dirt.addColorStop(0,'#c9a34f');dirt.addColorStop(.55,'#9e913f');dirt.addColorStop(1,'#71833d');ctx.fillStyle=dirt;ctx.fill();
    // Southern path and north-west stream echo the reference composition.
    ctx.beginPath();
    const pathPoints=[[-4,-42],[4,-42],[5,-19],[2,-12],[-2,-12],[-5,-20]];
    pathPoints.map(([x,z])=>this.project(x,z,.02)).forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.fillStyle='rgba(203,164,82,.78)';ctx.fill();
    const stream=[[-43,18],[-34,27],[-31,40],[-25,43],[-20,43],[-29,28],[-35,15]];
    ctx.beginPath();stream.map(([x,z])=>this.project(x,z,-.02)).forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.fillStyle='rgba(73,142,164,.72)';ctx.fill();
    for(const detail of this.groundDetails){
      if(Math.hypot(detail.x,detail.z)>39)continue;
      const p=this.project(detail.x,detail.z,.03);
      if(detail.kind==='flower'){ctx.fillStyle=detail.hue>.5?'#f2d36f':'#e59b69';ctx.fillRect(p.x,p.y,1.7*this.unit,1.7*this.unit);}
      else if(detail.kind==='blade'){ctx.strokeStyle='rgba(49,91,38,.55)';ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(p.x+2*this.unit,p.y-4*this.unit);ctx.stroke();}
      else{ctx.fillStyle='rgba(93,94,64,.45)';ctx.beginPath();ctx.ellipse(p.x,p.y,1.8*this.unit,1*this.unit,0,0,TAU);ctx.fill();}
    }
  }

  drawTree(tree) {
    if(tree.state==='fallen'){
      this.drawSprite({type:'treeFallen',x:tree.x,z:tree.z,scale:1});
      return;
    }
    if(tree.state==='falling'){
      const progress=1-clamp(tree.fallTimer/1.05,0,1);
      this.drawSprite({type:tree.hits>=4?'treeStage90':'treeStage75',x:tree.x,z:tree.z,scale:1,rotation:-easeOut(progress)*1.32});
      return;
    }
    const type=['treeStage0','treeStage25','treeStage50','treeStage75','treeStage90'][Math.min(tree.hits,4)];
    this.drawSprite({type,x:tree.x,z:tree.z,scale:1});
  }

  addFortDrawables(drawables) {
    if(this.base.stage===0){
      drawables.push({key:-.1,draw:()=>this.drawBuildZone()});
      return;
    }
    const posts=[];
    const total=36;
    for(let i=0;i<total;i+=1){
      const angle=-Math.PI*.33+i/total*(TAU-.56);
      if(Math.abs(wrapAngle(angle+Math.PI/2))<.23)continue;
      posts.push({angle,x:Math.cos(angle)*10,z:Math.sin(angle)*10,index:i});
    }
    const visible=Math.ceil(posts.length*this.base.stage/3);
    posts.slice(0,visible).forEach((post)=>drawables.push({key:post.x+post.z,draw:()=>this.drawPalisadePost(post)}));
    if(this.base.stage>=2) drawables.push({key:-10.2,draw:()=>this.drawGate(this.base.stage===2)});
    if(this.base.stage===3){
      drawables.push({key:8.9,draw:()=>this.drawTower()});
      drawables.push({key:-4,draw:()=>this.drawHut(-4.8,1.6,.9)});
      drawables.push({key:2,draw:()=>this.drawHut(4.4,-2.4,-.7)});
      drawables.push({key:-1,draw:()=>this.drawSprite({type:'logStack',x:-4.8,z:-.6,scale:.72})});
      drawables.push({key:.5,draw:()=>this.drawSprite({type:'campfire',x:.4,z:.2,scale:.75})});
    }
  }

  drawBuildZone() {
    const ctx=this.ctx;ctx.save();ctx.setLineDash([6,7]);ctx.strokeStyle='rgba(89,55,24,.72)';ctx.lineWidth=2;
    const points=[];for(let i=0;i<48;i+=1){const a=i/48*TAU;points.push(this.project(Math.cos(a)*10,Math.sin(a)*10,.03));}
    ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.stroke();ctx.setLineDash([]);
    for(let i=0;i<12;i+=1){const a=i/12*TAU,p=this.project(Math.cos(a)*10,Math.sin(a)*10,0),top=this.project(Math.cos(a)*10,Math.sin(a)*10,1.2);ctx.strokeStyle='#6d3d1b';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(top.x,top.y);ctx.stroke();}
    const c=this.project(0,0,.05);ctx.fillStyle='rgba(70,42,18,.72)';ctx.font=`700 ${13*this.unit}px Segoe UI`;ctx.textAlign='center';ctx.fillText('СТРОИТЕЛЬНАЯ ЗОНА',c.x,c.y);ctx.restore();
  }

  drawPalisadePost(post) {
    const damage=1-this.base.health/this.base.maxHealth;
    const broken=damage>.45 && post.index%Math.max(2,Math.floor(6-damage*5))===0;
    const height=broken?2.4:3.8;
    const base=this.project(post.x,post.z,0),top=this.project(post.x,post.z,height);
    const width=7.2*this.unit;
    const shade=damage>.72?'#4c2819':damage>.35?'#704225':'#8b5129';
    this.ctx.fillStyle='rgba(18,22,15,.25)';this.ctx.beginPath();this.ctx.ellipse(base.x+5*this.unit,base.y+4*this.unit,width,3*this.unit,.3,0,TAU);this.ctx.fill();
    this.ctx.fillStyle=shade;this.ctx.beginPath();this.ctx.moveTo(base.x-width/2,base.y);this.ctx.lineTo(base.x+width/2,base.y);this.ctx.lineTo(top.x+width*.35,top.y+width*.65);this.ctx.lineTo(top.x,top.y-(broken?0:width*.55));this.ctx.lineTo(top.x-width*.35,top.y+width*.65);this.ctx.closePath();this.ctx.fill();
    this.ctx.strokeStyle='rgba(48,25,14,.55)';this.ctx.lineWidth=1.2;this.ctx.stroke();
    if(damage>.65 && post.index%7===0){this.ctx.strokeStyle='#322018';this.ctx.beginPath();this.ctx.moveTo(top.x-3,top.y+10);this.ctx.lineTo(top.x+4,top.y+17);this.ctx.stroke();}
  }

  drawGate(scaffold=false) {
    const left=this.project(-2.25,-9.6,0),right=this.project(2.25,-9.6,0),lt=this.project(-2.25,-9.6,4.6),rt=this.project(2.25,-9.6,4.6);
    const ctx=this.ctx;ctx.strokeStyle='#5b311c';ctx.lineWidth=10*this.unit;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(left.x,left.y);ctx.lineTo(lt.x,lt.y);ctx.moveTo(right.x,right.y);ctx.lineTo(rt.x,rt.y);ctx.stroke();
    ctx.lineWidth=7*this.unit;ctx.beginPath();ctx.moveTo(lt.x,lt.y);ctx.lineTo(rt.x,rt.y);ctx.stroke();
    if(!scaffold){
      ctx.fillStyle='#70401f';ctx.beginPath();ctx.moveTo(left.x,left.y);ctx.lineTo(right.x,right.y);ctx.lineTo(rt.x,rt.y+8*this.unit);ctx.lineTo(lt.x,lt.y+8*this.unit);ctx.closePath();ctx.fill();
      ctx.strokeStyle='#a86b32';ctx.lineWidth=2;ctx.stroke();
      ctx.strokeStyle='#3d2417';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo((left.x+right.x)/2,(left.y+right.y)/2);ctx.lineTo((lt.x+rt.x)/2,(lt.y+rt.y)/2+8*this.unit);ctx.stroke();
    }
  }

  drawTower() {
    const x=4.8,z=4,ctx=this.ctx;
    const base=this.project(x,z,0),platform=this.project(x,z,6.4),roof=this.project(x,z,8.5);
    const legOffsets=[[-1,-1],[1,-1],[-1,1],[1,1]];
    ctx.strokeStyle='#4e2c19';ctx.lineWidth=6*this.unit;ctx.lineCap='round';
    for(const [dx,dz] of legOffsets){const a=this.project(x+dx,z+dz,0),b=this.project(x+dx*.7,z+dz*.7,6.2);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();}
    ctx.fillStyle='#6e4021';ctx.beginPath();ctx.moveTo(platform.x-29*this.unit,platform.y);ctx.lineTo(platform.x,platform.y-14*this.unit);ctx.lineTo(platform.x+29*this.unit,platform.y);ctx.lineTo(platform.x,platform.y+14*this.unit);ctx.closePath();ctx.fill();
    ctx.fillStyle='#5c3320';ctx.beginPath();ctx.moveTo(roof.x,roof.y-19*this.unit);ctx.lineTo(roof.x+35*this.unit,roof.y+9*this.unit);ctx.lineTo(roof.x,roof.y+23*this.unit);ctx.lineTo(roof.x-35*this.unit,roof.y+9*this.unit);ctx.closePath();ctx.fill();
    ctx.strokeStyle='#9d6635';ctx.lineWidth=2;ctx.stroke();
    // Ladder and flag.
    ctx.strokeStyle='#9b6739';ctx.lineWidth=2;for(let i=0;i<6;i++){const y=lerp(base.y,platform.y,i/6);ctx.beginPath();ctx.moveTo(base.x-8*this.unit,y);ctx.lineTo(base.x+6*this.unit,y-3*this.unit);ctx.stroke();}
    ctx.strokeStyle='#48311d';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(roof.x,roof.y-20*this.unit);ctx.lineTo(roof.x,roof.y-48*this.unit);ctx.stroke();
    ctx.fillStyle='#315d78';ctx.beginPath();ctx.moveTo(roof.x,roof.y-47*this.unit);ctx.lineTo(roof.x+29*this.unit,roof.y-38*this.unit);ctx.lineTo(roof.x,roof.y-30*this.unit);ctx.closePath();ctx.fill();
    for(let i=0;i<5;i++){ctx.fillStyle='#b2aa8b';ctx.beginPath();ctx.arc(platform.x-14*this.unit+i*7*this.unit,platform.y-4*this.unit-(i%2)*3,4*this.unit,0,TAU);ctx.fill();}
  }

  drawHut(x,z,flip=1) {
    const ctx=this.ctx,base=this.project(x,z,0),top=this.project(x,z,2.7),w=30*this.unit;
    ctx.fillStyle='#704320';ctx.beginPath();ctx.moveTo(base.x-w,base.y);ctx.lineTo(base.x+w,base.y);ctx.lineTo(top.x+w*.72,top.y);ctx.lineTo(top.x-w*.72,top.y);ctx.closePath();ctx.fill();
    ctx.fillStyle=flip>0?'#6a4228':'#345875';ctx.beginPath();ctx.moveTo(top.x-w,top.y+3);ctx.lineTo(top.x,top.y-22*this.unit);ctx.lineTo(top.x+w,top.y+3);ctx.lineTo(top.x,top.y+18*this.unit);ctx.closePath();ctx.fill();
    ctx.fillStyle='#2d1d14';ctx.fillRect(base.x-6*this.unit,base.y-22*this.unit,12*this.unit,22*this.unit);
  }

  drawCatapult(catapult) {
    const ctx=this.ctx,p=this.project(catapult.x,catapult.z,0),u=this.unit;
    ctx.save();if(catapult.hitFlash>0){ctx.shadowColor='#ffd06c';ctx.shadowBlur=24;}
    ctx.fillStyle='rgba(15,18,14,.3)';ctx.beginPath();ctx.ellipse(p.x,p.y+6*u,30*u,9*u,.2,0,TAU);ctx.fill();
    const wood=catapult.destroyed?'#4b2b1c':'#6f3c20';
    ctx.strokeStyle=wood;ctx.lineWidth=7*u;ctx.lineCap='round';
    ctx.beginPath();ctx.moveTo(p.x-25*u,p.y);ctx.lineTo(p.x+22*u,p.y);ctx.moveTo(p.x-18*u,p.y);ctx.lineTo(p.x,p.y-34*u);ctx.lineTo(p.x+18*u,p.y);ctx.stroke();
    ctx.fillStyle='#33241c';for(const dx of [-18,18]){ctx.beginPath();ctx.arc(p.x+dx*u,p.y+5*u,9*u,0,TAU);ctx.fill();ctx.strokeStyle='#7c5732';ctx.lineWidth=2;ctx.stroke();}
    const recoil=catapult.recoil;
    const armAngle=catapult.destroyed?1.25:-.82+recoil*.85;
    ctx.save();ctx.translate(p.x,p.y-28*u);ctx.rotate(armAngle);ctx.strokeStyle=wood;ctx.lineWidth=6*u;ctx.beginPath();ctx.moveTo(0,18*u);ctx.lineTo(0,-39*u);ctx.stroke();ctx.fillStyle='#56301d';ctx.fillRect(-10*u,-46*u,20*u,12*u);ctx.restore();
    if(catapult.destroyed){ctx.strokeStyle='#b07842';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(p.x-25*u,p.y-8*u);ctx.lineTo(p.x-7*u,p.y+9*u);ctx.moveTo(p.x+7*u,p.y-18*u);ctx.lineTo(p.x+28*u,p.y+5*u);ctx.stroke();}
    ctx.restore();
  }

  drawGoblin(goblin) {
    const ctx=this.ctx,p=this.project(goblin.x,goblin.z,0),u=this.unit,bob=Math.sin(goblin.phase)*2*u;
    ctx.fillStyle='rgba(14,20,12,.28)';ctx.beginPath();ctx.ellipse(p.x,p.y+3*u,14*u,5*u,0,0,TAU);ctx.fill();
    ctx.save();ctx.translate(0,bob);if(goblin.hitFlash>0){ctx.shadowColor='#fff08a';ctx.shadowBlur=18;}
    ctx.fillStyle='#435d2e';ctx.beginPath();ctx.ellipse(p.x,p.y-16*u,10*u,14*u,0,0,TAU);ctx.fill();
    ctx.fillStyle='#718b3a';ctx.beginPath();ctx.arc(p.x,p.y-31*u,10*u,0,TAU);ctx.fill();
    ctx.beginPath();ctx.moveTo(p.x-9*u,p.y-34*u);ctx.lineTo(p.x-18*u,p.y-29*u);ctx.lineTo(p.x-8*u,p.y-26*u);ctx.moveTo(p.x+9*u,p.y-34*u);ctx.lineTo(p.x+18*u,p.y-29*u);ctx.lineTo(p.x+8*u,p.y-26*u);ctx.fill();
    ctx.fillStyle='#d7a54b';ctx.fillRect(p.x-5*u,p.y-33*u,3*u,2*u);ctx.fillRect(p.x+3*u,p.y-33*u,3*u,2*u);
    ctx.strokeStyle='#5a3420';ctx.lineWidth=3*u;ctx.beginPath();ctx.moveTo(p.x+8*u,p.y-17*u);ctx.lineTo(p.x+18*u,p.y-35*u);ctx.stroke();ctx.restore();
  }

  drawPlayer() {
    const p=this.project(this.player.x,this.player.z,this.player.y),ctx=this.ctx,u=this.unit;
    ctx.save();if(this.player.hitFlash>0){ctx.shadowColor='#ff5d3d';ctx.shadowBlur=30;}
    ctx.fillStyle='rgba(20,20,14,.3)';ctx.beginPath();ctx.ellipse(p.x,p.y+3*u,13*u,5*u,0,0,TAU);ctx.fill();
    ctx.fillStyle='#2c352d';ctx.beginPath();ctx.moveTo(p.x-9*u,p.y);ctx.lineTo(p.x+9*u,p.y);ctx.lineTo(p.x+6*u,p.y-29*u);ctx.lineTo(p.x-6*u,p.y-29*u);ctx.closePath();ctx.fill();
    ctx.fillStyle='#e3d1a6';ctx.fillRect(p.x-8*u,p.y-27*u,16*u,15*u);
    ctx.fillStyle='#5b3825';ctx.beginPath();ctx.arc(p.x,p.y-38*u,9*u,0,TAU);ctx.fill();
    ctx.fillStyle='#3b2b21';ctx.beginPath();ctx.arc(p.x,p.y-42*u,9*u,Math.PI,TAU);ctx.fill();
    ctx.fillStyle='#744729';ctx.fillRect(p.x-11*u,p.y-28*u,5*u,20*u);
    if(this.player.carrying){
      ctx.fillStyle='#6f3e20';ctx.save();ctx.translate(p.x-8*u,p.y-20*u);ctx.rotate(-.65);ctx.fillRect(-23*u,-5*u,46*u,10*u);ctx.fillStyle='#d49a55';ctx.beginPath();ctx.arc(-23*u,0,5*u,0,TAU);ctx.fill();ctx.restore();
    }
    const swing=1-clamp(this.player.axeSwing/CONFIG.CHOP_DURATION,0,1);
    const axeAngle=this.player.axeSwing>0?-1.8+Math.sin(swing*Math.PI)*1.7:-.35;
    ctx.save();ctx.translate(p.x+7*u,p.y-22*u);ctx.rotate(axeAngle);ctx.strokeStyle='#6d3c20';ctx.lineWidth=3.5*u;ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(0,-30*u);ctx.stroke();ctx.fillStyle='#3d4d55';ctx.fillRect(-8*u,-34*u,16*u,8*u);ctx.restore();
    ctx.restore();
  }

  drawProjectiles() {
    const ctx=this.ctx,u=this.unit;
    for(const projectile of this.projectiles){
      const ground=this.project(projectile.target.x,projectile.target.z,0);
      const pulse=.8+Math.sin(performance.now()/110)*.15;
      ctx.strokeStyle='rgba(193,56,36,.72)';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(ground.x,ground.y,18*u*pulse,8*u*pulse,0,0,TAU);ctx.stroke();
      const p=this.project(projectile.x,projectile.z,projectile.y);ctx.fillStyle='#544e45';ctx.beginPath();ctx.arc(p.x,p.y,7*u,0,TAU);ctx.fill();ctx.strokeStyle='rgba(241,198,110,.45)';ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(p.x-10*u,p.y+9*u);ctx.stroke();
    }
    for(const stone of this.stones){const p=this.project(stone.x,stone.z,stone.y);ctx.fillStyle='#c9b783';ctx.shadowColor='#ffe078';ctx.shadowBlur=12;ctx.beginPath();ctx.arc(p.x,p.y,7*u,0,TAU);ctx.fill();ctx.shadowBlur=0;}
  }

  drawParticles() {
    const ctx=this.ctx,u=this.unit;
    for(const particle of this.particles){const p=this.project(particle.x,particle.z,particle.y);if(particle.kind==='spark'){ctx.strokeStyle='#ffd45b';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(p.x-particle.vx*3*u,p.y+4*u);ctx.stroke();}else if(particle.kind==='repair'){ctx.fillStyle='#8ed36c';ctx.fillRect(p.x,p.y,4*u,4*u);}else{ctx.fillStyle=particle.kind==='chip'?'#d88a3e':'rgba(174,143,93,.45)';ctx.beginPath();ctx.arc(p.x,p.y,(particle.kind==='chip'?3:5)*u,0,TAU);ctx.fill();}}
  }

  drawNote(note) {
    const p=this.project(note.x,note.z,.45+Math.sin(note.float)*.12),ctx=this.ctx,u=this.unit;
    ctx.save();ctx.shadowColor='#ffd66f';ctx.shadowBlur=18;ctx.fillStyle='#f1d18b';ctx.beginPath();ctx.moveTo(p.x,p.y-9*u);ctx.lineTo(p.x+11*u,p.y);ctx.lineTo(p.x,p.y+9*u);ctx.lineTo(p.x-11*u,p.y);ctx.closePath();ctx.fill();ctx.shadowBlur=0;ctx.strokeStyle='#8d5f2e';ctx.lineWidth=1.5;ctx.stroke();ctx.strokeStyle='#9d6b36';ctx.beginPath();ctx.moveTo(p.x-5*u,p.y-2*u);ctx.lineTo(p.x+5*u,p.y-2*u);ctx.moveTo(p.x-4*u,p.y+2*u);ctx.lineTo(p.x+3*u,p.y+2*u);ctx.stroke();ctx.restore();
  }

  drawVignette() {
    const gradient=this.ctx.createRadialGradient(this.width*.5,this.height*.48,this.height*.28,this.width*.5,this.height*.48,this.width*.72);
    gradient.addColorStop(0,'rgba(0,0,0,0)');gradient.addColorStop(.7,'rgba(12,27,19,.08)');gradient.addColorStop(1,'rgba(6,15,11,.56)');this.ctx.fillStyle=gradient;this.ctx.fillRect(0,0,this.width,this.height);
  }

  runDevAction(action) {
    if(action==='build'){this.player.carrying=true;this.deliverLog();}
    if(action==='attack')this.activateAttack();
    if(action==='damage')this.damageBase(280,'DEV: урон базе');
    if(action==='log'){this.player.carrying=true;this.showToast('DEV: бревно выдано');}
    if(action==='tower'){while(this.base.stage<3){this.player.carrying=true;this.deliverLog();}this.enterTower();}
    if(action==='win'){this.noteCount=CONFIG.TOTAL_NOTES;this.endGame('victory');}
    if(action==='lose-player'){this.player.health=1;this.player.invulnerability=0;this.damagePlayer();}
    if(action==='lose-base'){this.base.health=1;this.damageBase(5);}
    this.updateUI();
  }

  updateDemo() {
    const t=this.realElapsed;
    const once=(name,at,fn)=>{if(t>=at&&!this.demoEvents.has(name)){this.demoEvents.add(name);fn();}};
    const tree=this.trees[1];
    once('move-tree',.5,()=>{this.player.x=15;this.player.z=-10;});
    [1.0,1.8,2.6,3.4].forEach((at,index)=>once(`chop-${index}`,at,()=>{tree.chopTimer=CONFIG.CHOP_DURATION*.5;tree.hitApplied=false;this.player.axeSwing=CONFIG.CHOP_DURATION;}));
    once('carry',4.8,()=>{tree.state='fallen';tree.hits=4;this.player.carrying=true;this.player.x=10;this.player.z=-7;});
    once('stage1',6.1,()=>{this.player.x=0;this.player.z=-5;this.deliverLog();});
    once('stage2',7.6,()=>{this.player.carrying=true;this.deliverLog();});
    once('stage3',9.1,()=>{this.player.carrying=true;this.deliverLog();});
    once('attack',10.8,()=>this.activateAttack());
    once('damage',12.8,()=>this.damageBase(420,'Демонстрация повреждения'));
    once('repair-log',14.1,()=>{this.player.carrying=true;this.player.x=0;this.player.z=-8.2;});
    once('repair',14.8,()=>this.repairBase());
    once('tower',16.2,()=>this.enterTower());
    once('question',17.0,()=>this.openQuestion());
    once('answer',18.1,()=>{if(this.question)this.answerQuestion(this.question.answer);});
    once('stone1',19.0,()=>{this.player.stoneReady=true;this.throwStone(0);});
    once('stone2',21.5,()=>{this.player.stoneReady=true;this.throwStone(0);});
    once('destroy-rest',24.0,()=>{this.destroyCatapult(this.catapults[1]);this.destroyCatapult(this.catapults[2]);this.leaveTower();});
    once('collect',26.0,()=>{for(const note of this.notes){note.x=this.player.x+(Math.random()-.5);note.z=this.player.z+(Math.random()-.5);}});
  }

  exposeDebugAPI() {
    window.__forestDefense={
      game:this,
      snapshot:()=>({state:this.gameState,elapsed:this.elapsed,player:{...this.player},base:{...this.base},logs:this.logsDelivered,notes:this.noteCount,attack:this.attackActive,catapults:this.catapults.map(({health,destroyed})=>({health,destroyed})),goblins:this.goblins.length,projectiles:this.projectiles.length}),
      debug:{
        setBuildStage:(stage)=>{this.base.stage=clamp(stage,0,3);this.logsDelivered=this.base.stage;this.updateUI();},
        giveLog:()=>{this.player.carrying=true;this.updateUI();},
        startAttack:()=>this.activateAttack(),
        damageBase:(amount=300)=>this.damageBase(amount,'DEV damage'),
        repair:()=>{this.player.carrying=true;this.repairBase();},
        enterTower:()=>{this.base.stage=3;this.logsDelivered=3;this.enterTower();},
        openQuestion:()=>this.openQuestion(),
        answerWrong:()=>this.question&&this.answerQuestion('__wrong__'),
        answerCorrect:()=>this.question&&this.answerQuestion(this.question.answer),
        throwAt:(index=0)=>{this.player.stoneReady=true;this.throwStone(index);},
        destroyCatapult:(index=0)=>{this.catapults[index].health=1;this.hitCatapult(this.catapults[index]);},
        placeNotesAtPlayer:()=>{for(const note of this.notes){note.x=this.player.x;note.z=this.player.z;}},
        defeatPlayer:()=>{this.player.health=1;this.player.invulnerability=0;this.damagePlayer();},
        defeatBase:()=>{this.base.health=1;this.damageBase(5);},
        win:()=>{this.noteCount=6;this.endGame('victory');},
      },
    };
  }
}

const manifest={
  treePine:'/assets/forest_defense/sprites/tree_pine.png',
  treePineSmall:'/assets/forest_defense/sprites/tree_pine_small.png',
  treeOak:'/assets/forest_defense/sprites/tree_oak.png',
  treeStage0:'/assets/forest_defense/sprites/tree_stage_0.png',
  treeStage25:'/assets/forest_defense/sprites/tree_stage_25.png',
  treeStage50:'/assets/forest_defense/sprites/tree_stage_50.png',
  treeStage75:'/assets/forest_defense/sprites/tree_stage_75.png',
  treeStage90:'/assets/forest_defense/sprites/tree_stage_90.png',
  treeFallen:'/assets/forest_defense/sprites/tree_stage_fallen.png',
  stump:'/assets/forest_defense/sprites/stump.png',
  rockLarge:'/assets/forest_defense/sprites/rock_large.png',
  rockSmall:'/assets/forest_defense/sprites/rock_small.png',
  grass:'/assets/forest_defense/sprites/grass.png',
  log:'/assets/forest_defense/sprites/log.png',
  logStack:'/assets/forest_defense/sprites/log_stack.png',
  fence:'/assets/forest_defense/sprites/fence.png',
  gate:'/assets/forest_defense/sprites/gate.png',
  tent:'/assets/forest_defense/sprites/tent.png',
  campfire:'/assets/forest_defense/sprites/campfire.png',
  pot:'/assets/forest_defense/sprites/pot.png',
};

const loadingBar=document.getElementById('loading-bar');
const loader=new AssetLoader((progress)=>{loadingBar.style.width=`${Math.round(progress*100)}%`;});
loader.load(manifest).then((assets)=>{
  const game=new ForestDefenseGame(document.getElementById('game-canvas'),assets);
  game.start();
}).catch((error)=>{
  console.error(error);
  document.querySelector('#loading p').textContent=`Ошибка загрузки: ${error.message}`;
});
