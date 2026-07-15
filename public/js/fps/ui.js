import { CONFIG } from "./config.js";


export class UIManager {
  constructor() {
    const byId = (id) => document.getElementById(id);
    this.elements = {
      loading: byId("loading"), loadingBar: byId("loading-bar"), loadingStatus: byId("loading-status"), loadingDetail: byId("loading-detail"),
      startScreen: byId("boot"), startButton: byId("start"), performanceBadge: byId("performance-badge"), hud: byId("hud"), pause: byId("pause-screen"),
      healthText: byId("health-text"), healthBar: byId("health-bar"), baseText: byId("base-health-text"), baseBar: byId("base-health-bar"),
      phase: byId("phase-label"), timer: byId("attack-timer"), timerSubtitle: byId("attack-subtitle"),
      objectiveTitle: byId("objective-title"), objectiveText: byId("objective-text"), logs: byId("logs-count"), stage: byId("build-stage"), notes: byId("notes-count"),
      prompt: byId("interaction-prompt"), promptText: byId("interaction-prompt")?.querySelector("span"), carry: byId("carry-indicator"), chopProgress: byId("chop-progress"), chopProgressText: byId("chop-progress")?.querySelector("span"), chopProgressBar: byId("chop-progress")?.querySelector("em"), towerTargets: byId("tower-targets"), leaveTower: byId("leave-tower-button"),
      warning: byId("warning"), toasts: byId("toast-stack"), damage: byId("damage-vignette"), dodge: byId("dodge-flash"),
      questionModal: byId("question-modal"), questionPrompt: byId("question-prompt"), questionOptions: byId("question-options"), questionFeedback: byId("question-feedback"),
      debugPanel: byId("debug-panel"), debugFps: byId("debug-fps"), debugStage: byId("debug-stage"), debugGate: byId("debug-gate"), debugAgents: byId("debug-agents"), debugPath: byId("debug-path"), debugState: byId("debug-state"),
      end: byId("end-screen"), endCrest: byId("end-crest"), endKicker: byId("end-kicker"), endTitle: byId("end-title"), endMessage: byId("end-message"), endNotes: byId("end-notes"), endBase: byId("end-base"), restart: byId("restart-button"),
    };
    this.warningTimer = null;
    this.questionHandler = null;
  }

  setLoading(progress, key="") {
    this.elements.loadingBar.style.width = `${Math.round(progress * 100)}%`;
    const labels = {
      world: "Детализированный лес", fort1: "Первая стадия крепости", fort2: "Вторая стадия крепости", fort3: "Готовая крепость",
      nav0: "Navmesh поляны", nav1: "Navmesh стадии 1", nav2: "Navmesh стадии 2", nav3Open: "Navmesh открытых ворот", nav3Closed: "Navmesh закрытых ворот",
      goblin: "Гоблины", catapult: "Катапульты",
      viewAxe: "Модель хвата топора", viewStone: "Модель хвата камня", viewLog: "Модель хвата бревна",
      axe: "Существующий топор",
    };
    if (labels[key]) this.elements.loadingDetail.textContent = labels[key];
  }

  loadingComplete() {
    this.elements.loading.classList.add("hidden");
    this.elements.startScreen.classList.remove("hidden");
  }

  setPerformanceProfile(profile, description) {
    if (!this.elements.performanceBadge) return;
    this.elements.performanceBadge.dataset.profile = profile.id;
    this.elements.performanceBadge.querySelector("span").textContent = `${profile.label} · ${description}`;
  }

  startGame() {
    this.elements.startScreen.classList.add("hidden");
    this.elements.hud.classList.remove("hidden");
  }

  setPaused(paused) {
    this.elements.pause.classList.toggle("hidden", !paused);
  }

  update({ playerHealth, baseHealth, elapsed, attackActive, logs, stage, notes, objective, debug }) {
    this.elements.healthText.textContent = `${playerHealth} / ${CONFIG.PLAYER.MAX_HEALTH}`;
    this.elements.healthBar.style.width = `${playerHealth / CONFIG.PLAYER.MAX_HEALTH * 100}%`;
    this.elements.baseText.textContent = `${Math.ceil(baseHealth)} / ${CONFIG.BUILD.MAX_HEALTH}`;
    this.elements.baseBar.style.width = `${baseHealth / CONFIG.BUILD.MAX_HEALTH * 100}%`;
    const remaining = Math.max(0, Math.ceil(CONFIG.ATTACK.START_SECONDS - elapsed));
    this.elements.phase.textContent = attackActive ? "ОБОРОНА" : "ПОДГОТОВКА";
    this.elements.timer.textContent = attackActive ? "БОЙ" : `${String(Math.floor(remaining / 60)).padStart(2, "0")}:${String(remaining % 60).padStart(2, "0")}`;
    this.elements.timerSubtitle.textContent = attackActive ? "НАПАДЕНИЕ ИДЁТ" : "ДО НАПАДЕНИЯ";
    this.elements.logs.textContent = `${logs} / ${CONFIG.BUILD.TOTAL_LOGS}`;
    this.elements.stage.textContent = `${stage} / 3`;
    this.elements.notes.textContent = `${notes} / ${CONFIG.NOTES.TOTAL}`;
    this.elements.objectiveTitle.textContent = objective.title;
    this.elements.objectiveText.textContent = objective.text;
    if (debug) {
      this.elements.debugFps.textContent = `${debug.fps} FPS`;
      this.elements.debugStage.textContent = String(stage);
      this.elements.debugGate.textContent = debug.gate;
      this.elements.debugAgents.textContent = String(debug.agents);
      this.elements.debugPath.textContent = debug.path;
      this.elements.debugState.textContent = debug.state;
    }
  }

  setPrompt(text) {
    const visible = Boolean(text);
    this.elements.prompt.classList.toggle("hidden", !visible);
    if (visible) this.elements.promptText.textContent = text;
  }

  setCarrying(value) {
    this.elements.carry.classList.toggle("hidden", !value);
  }

  setChopProgress(progress = null) {
    const visible = progress && progress.state === "standing";
    this.elements.chopProgress.classList.toggle("hidden", !visible);
    if (!visible) return;
    const access = progress.hitCredits > 0
      ? ` · доступно ударов ${progress.hitCredits}`
      : progress.nextGrant > 0
        ? ` · следующий вопрос откроет ${progress.nextGrant}`
        : "";
    this.elements.chopProgressText.textContent = `${progress.hits} / ${CONFIG.CHOP.HITS} ударов${access}`;
    this.elements.chopProgressBar.style.width = `${Math.min(100, Math.max(0, progress.ratio * 100))}%`;
  }

  setTowerTargets(value) {
    this.elements.towerTargets.classList.toggle("hidden", !value);
  }

  setLeaveTower(value) {
    this.elements.leaveTower.classList.toggle("hidden", !value);
  }

  toast(text, duration=2600) {
    const item = document.createElement("div");
    item.className = "toast";
    item.textContent = text;
    this.elements.toasts.appendChild(item);
    setTimeout(() => item.remove(), duration);
  }

  warning(text, duration=3200) {
    clearTimeout(this.warningTimer);
    this.elements.warning.textContent = text;
    this.elements.warning.classList.remove("hidden");
    this.warningTimer = setTimeout(() => this.elements.warning.classList.add("hidden"), duration);
  }

  flashDamage() {
    this.elements.damage.classList.add("active");
    setTimeout(() => this.elements.damage.classList.remove("active"), 380);
  }

  flashDodge() {
    this.elements.dodge.classList.add("active");
    setTimeout(() => this.elements.dodge.classList.remove("active"), 190);
  }

  setDebug(visible) {
    this.elements.debugPanel.classList.toggle("hidden", !visible);
  }

  showQuestion(question, onAnswer) {
    this.questionHandler = onAnswer;
    this.elements.questionPrompt.textContent = question.prompt;
    this.elements.questionFeedback.textContent = "";
    this.elements.questionFeedback.className = "question-feedback";
    this.elements.questionOptions.innerHTML = "";
    question.options.forEach((option, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = `${index + 1}. ${option}`;
      button.addEventListener("click", () => onAnswer(option));
      this.elements.questionOptions.appendChild(button);
    });
    this.elements.questionModal.classList.remove("hidden");
  }

  questionResult(correct) {
    this.elements.questionFeedback.textContent = correct ? "Richtig! Камень подготовлен." : "Nicht richtig. Попробуйте другое задание.";
    this.elements.questionFeedback.className = `question-feedback${correct ? "" : " error"}`;
    for (const button of this.elements.questionOptions.querySelectorAll("button")) button.disabled = true;
  }

  hideQuestion() {
    this.elements.questionModal.classList.add("hidden");
    this.questionHandler = null;
  }

  end(reason, { notes, baseHealth }) {
    const victory = reason === "victory";
    this.elements.endCrest.textContent = victory ? "✓" : "×";
    this.elements.endKicker.textContent = victory ? "WALDWACHT ВЫСТОЯЛ" : reason === "player" ? "ЗАЩИТНИК ПАЛ" : "ЧАСТОКОЛ СЛОМЛЕН";
    this.elements.endTitle.textContent = victory ? "Победа" : reason === "player" ? "Поражение" : "Крепость разрушена";
    this.elements.endMessage.textContent = victory
      ? "Все записки собраны, катапульты уничтожены, а крепость сохранилась."
      : reason === "player" ? "Третье попадание оказалось смертельным." : "Прочность стен упала до нуля.";
    this.elements.endNotes.textContent = `${notes} / ${CONFIG.NOTES.TOTAL}`;
    this.elements.endBase.textContent = String(Math.ceil(baseHealth));
    this.elements.end.classList.remove("hidden");
  }
}
