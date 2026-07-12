import assert from 'node:assert/strict';
import { CONFIG } from '../public/js/config.js';
import { GERMAN_QUESTIONS } from '../public/js/questions.js';


class ClassList {
  constructor() { this.values = new Set(); }
  add(...items) { items.forEach((item) => this.values.add(item)); }
  remove(...items) { items.forEach((item) => this.values.delete(item)); }
  contains(item) { return this.values.has(item); }
}

class ElementStub {
  constructor(id = '') {
    this.id = id;
    this.classList = new ClassList();
    this.children = [];
    this.dataset = {};
    this.style = {};
    this.textContent = '';
    this.className = '';
    this.disabled = false;
    this.listeners = {};
  }
  addEventListener(name, callback) { this.listeners[name] = callback; }
  appendChild(child) { this.children.push(child); return child; }
  set innerHTML(value) { this.children = []; this._innerHTML = value; }
  get innerHTML() { return this._innerHTML || ''; }
}

const ids = [
  'restart-button', 'dev-panel', 'loading', 'hud', 'loading-bar', 'question-modal',
  'question-prompt', 'question-options', 'question-feedback', 'end-title', 'end-message',
  'end-crest', 'end-screen', 'toast', 'warning', 'player-hearts', 'base-health-text',
  'base-health-bar', 'attack-timer', 'logs-count', 'build-stage', 'notes-count',
  'carry-state', 'objective-title', 'objective-text', 'interaction-prompt',
];
const elements = new Map(ids.map((id) => [id, new ElementStub(id)]));
const canvasContext = { setTransform() {} };
const canvas = new ElementStub('game-canvas');
canvas.getContext = () => canvasContext;
elements.set('game-canvas', canvas);

globalThis.document = {
  getElementById(id) { return elements.get(id) || null; },
  querySelector(selector) { return selector === '#loading p' ? elements.get('loading') : null; },
  querySelectorAll(selector) {
    if (selector === '#question-options button') return elements.get('question-options').children;
    return [];
  },
  createElement() { return new ElementStub(); },
};
globalThis.window = { addEventListener() {} };
globalThis.location = { search: '?dev=1', reload() {} };
globalThis.innerWidth = 1280;
globalThis.innerHeight = 720;
globalThis.devicePixelRatio = 1;
globalThis.requestAnimationFrame = () => 0;
globalThis.clearTimeout = () => {};
globalThis.setTimeout = (callback) => { callback(); return 0; };
globalThis.Image = class {
  set src(value) { this._src = value; queueMicrotask(() => this.onload?.()); }
  get src() { return this._src; }
};

await import('../public/js/game.js');
for (let index = 0; index < 8 && !window.__forestDefense; index += 1) await Promise.resolve();
assert.ok(window.__forestDefense, 'game bootstrap should expose its test API');
const game = window.__forestDefense.game;
const debug = window.__forestDefense.debug;
const passed = [];
const pass = (name) => passed.push(name);

// A — real four-hit chop, fall/log result and three-stage fort construction.
const tree = game.trees[0];
game.player.x = tree.x - 2;
game.player.z = tree.z;
for (let hit = 0; hit < 4; hit += 1) {
  game.startChop(tree);
  game.updateTrees(CONFIG.CHOP_DURATION);
}
game.updateTrees(1.1);
assert.equal(tree.state, 'fallen');
assert.ok(game.groundLogs.some((log) => log.id === `log-${tree.id}`));
const log = game.groundLogs.find((item) => item.id === `log-${tree.id}`);
game.pickupLog(log);
game.deliverLog();
game.player.carrying = true; game.deliverLog();
game.player.carrying = true; game.deliverLog();
assert.equal(game.base.stage, 3);
assert.equal(game.logsDelivered, 3);
pass('A construction');

// B — normal attack gate remains exactly 180 seconds and spawns six goblins.
game.attackActive = false;
game.elapsed = 179.9;
game.updateAttackTimer();
assert.equal(game.attackActive, false);
game.elapsed = 180;
game.updateAttackTimer();
assert.equal(game.attackActive, true);
assert.equal(game.goblins.length, 6);
assert.equal(game.catapults.length, 3);
pass('B attack at 180s');

// C — one carried log repairs but never exceeds maximum health.
game.base.health = 500;
game.player.carrying = true;
game.repairBase();
assert.equal(game.base.health, 750);
assert.equal(game.player.carrying, false);
pass('C repair');

// D/E — projectile hit costs one heart; a warned miss costs none.
game.gameOver = false;
game.player.health = 3;
game.player.invulnerability = 0;
game.player.x = 0; game.player.z = 0;
game.impactCatapultProjectile({ targetPlayer: true, target: { x: 8, z: 8 } });
assert.equal(game.player.health, 3);
game.impactCatapultProjectile({ targetPlayer: true, target: { x: 0, z: 0 } });
assert.equal(game.player.health, 2);
game.player.invulnerability = 0; game.damagePlayer();
game.player.invulnerability = 0; game.damagePlayer();
assert.equal(game.gameState, 'playerDefeated');
pass('D player damage');
pass('E dodge/miss');

// F — wrong answer grants nothing; correct answer grants exactly one stone.
game.gameOver = false;
game.player.health = 3;
game.base.health = 750;
game.base.stage = 3;
game.enterTower();
game.openQuestion();
assert.ok(game.question);
game.answerQuestion('__wrong__');
assert.equal(game.player.stoneReady, false);
assert.ok(game.question);
const answer = game.question.answer;
game.answerQuestion(answer);
assert.equal(game.player.stoneReady, true);
assert.equal(game.question, null);
assert.ok(GERMAN_QUESTIONS.length >= 20);
pass('F German question');

// G — two visual ballistic stones destroy one catapult and stop future firing.
const target = game.catapults[0];
target.health = 2; target.destroyed = false;
debug.throwAt(0); game.updateProjectiles(3);
assert.equal(target.health, 1);
debug.throwAt(0); game.updateProjectiles(3);
assert.equal(target.destroyed, true);
assert.equal(game.notes.length, 2);
const projectileCount = game.projectiles.length;
game.attackActive = true;
target.nextFire = 0;
game.catapults[1].nextFire = 999;
game.catapults[2].nextFire = 999;
game.updateCatapults(100);
assert.equal(game.projectiles.length, projectileCount);
pass('G catapult destruction');

// H — all three defeated catapults produce six unique notes and collection wins.
debug.destroyCatapult(1);
debug.destroyCatapult(2);
assert.equal(game.notes.length, CONFIG.TOTAL_NOTES);
game.leaveTower();
debug.placeNotesAtPlayer();
game.collectNearbyNotes();
assert.equal(game.noteCount, CONFIG.TOTAL_NOTES);
assert.equal(game.gameState, 'victory');
pass('H notes and victory');

// I — zero base health produces the independent base-destruction defeat.
game.gameOver = false;
game.base.health = 1;
game.damageBase(2);
assert.equal(game.gameState, 'baseDestroyed');
assert.equal(game.base.health, 0);
pass('I base defeat');

console.log(`FOREST_DEFENSE_LOGIC_OK ${passed.length}/9`);
console.log(passed.join(' | '));
