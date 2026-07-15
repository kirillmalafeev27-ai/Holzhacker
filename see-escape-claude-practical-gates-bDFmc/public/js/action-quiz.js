function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function actionTitle(action) {
  if (action === "island") return "Задание на острове";
  if (action === "patch") return "Задание перед ремонтом";
  if (action === "fire") return "Задание перед выстрелом";
  return "Задание";
}

function actionSuccess(action) {
  if (action === "island") return "Верно. Можно сделать шаг.";
  if (action === "patch") return "Верно. Можно заколотить пробоину.";
  if (action === "fire") return "Верно. Пушка твоя.";
  return "Верно.";
}

function actionFailure(action) {
  if (action === "island") return "Неверно. Шаг не сделан.";
  if (action === "patch") return "Неверно. Доска остаётся в руках, пробоина пока открыта.";
  if (action === "fire") return "Неверно. Пушка не стреляет.";
  return "Неверно.";
}

function normalizeQuestion(question) {
  if (!question) return null;
  const choices = Array.isArray(question.choices)
    ? question.choices
    : Array.isArray(question.options)
    ? question.options
    : [];
  const correctIndex = Number.isInteger(question.correctIndex)
    ? question.correctIndex
    : Number.isInteger(question.correct)
    ? question.correct
    : choices.indexOf(question.correct);
  if (!choices.length || correctIndex < 0 || correctIndex >= choices.length) return null;
  return { ...question, choices, correctIndex };
}

export class ActionQuizGate {
  constructor({ audioGuide = null, onActiveChange = null } = {}) {
    this.audioGuide = audioGuide;
    this.onActiveChange = onActiveChange || (() => {});
    this.active = false;
    this.questionCounter = 0;
    this.current = null;
    this.resolveCurrent = null;
    this.panel = this._createPanel();
  }

  _createPanel() {
    let panel = document.getElementById("actionQuiz");
    if (!panel) {
      panel = document.createElement("section");
      panel.id = "actionQuiz";
      panel.className = "panel";
      panel.hidden = true;
      document.body.appendChild(panel);
    }
    panel.addEventListener("pointerdown", (event) => event.stopPropagation());
    panel.addEventListener("click", (event) => event.stopPropagation());
    return panel;
  }

  async prepare(count = 10) {
    const prepare = window.prepareSeaQuiz || window.prepareMostyQuiz;
    if (typeof prepare !== "function") return { ok: true, generated: false };
    return prepare({ floors: 10, startFloor: 1, poolMode: true });
  }

  async request(action, context = {}) {
    if (this.active) return false;
    const sequence = ++this.questionCounter;
    const quizContext = { ...context, poolMode: true };
    await window.quizEnsureQuestionAvailable?.(quizContext);
    const question = normalizeQuestion(window.pickQuestion?.("mix", quizContext));
    if (!question) return false;

    this.active = true;
    this.current = { action, question };
    this.onActiveChange(true);
    this._render(action, question);
    window.playQuizAudio?.(question, true);

    this.audioGuide?.event?.(`${actionTitle(action)}. ${question.text || question.q || ""}. ${question.translation ? `Русский перевод: ${question.translation}` : ""}`, {
      id: `action-quiz-${action}-${sequence}`,
      priority: 3,
      interrupt: true,
      cooldown: 0,
    });

    return new Promise((resolve) => {
      this.resolveCurrent = resolve;
    });
  }

  _render(action, question) {
    const pool = window.getQuizPoolState?.();
    const sourceLabel = question.source === "generated" ? "ИИ" : "Fallback";
    const poolLabel = pool
      ? `${sourceLabel} · ${question.topic || question.level || ""} · пул ${pool.correct}/${pool.size} верно · ${pool.remaining} осталось`
      : (question.topic || question.level || "");
    const translation = question.translation
      ? `<span class="question-translation"><b>Русский перевод:</b> ${escapeHtml(question.translation)}</span>`
      : "";
    const body = question.audioText
      ? `${escapeHtml(question.text || "")}<span>${escapeHtml(question.display || "")}</span>${translation}`
      : `${escapeHtml(question.text || "")}<span>${escapeHtml(question.display || question.q || "")}</span>${translation}`;
    this.panel.innerHTML = `
      <div class="action-quiz-head">
        <b>${escapeHtml(actionTitle(action))}</b>
        <span>${escapeHtml(poolLabel)}</span>
      </div>
      <div class="action-quiz-question">${body}</div>
      <div class="action-quiz-options">
        ${(question.choices || []).map((choice, index) => `
          <button type="button" data-answer="${index}">
            <span>${String.fromCharCode(65 + index)}</span>${escapeHtml(choice)}
          </button>
        `).join("")}
      </div>
      <div class="action-quiz-status">Выбери правильный ответ, чтобы выполнить действие.</div>
    `;
    this.panel.hidden = false;
    this.panel.querySelectorAll("[data-answer]").forEach((button) => {
      let submitted = false;
      const submit = (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (submitted || button.disabled) return;
        submitted = true;
        this._answer(Number(button.dataset.answer));
      };
      button.addEventListener("pointerdown", submit);
      button.addEventListener("click", submit);
    });
    this.panel.querySelector("[data-answer]")?.focus({ preventScroll: true });
  }

  _answer(index) {
    if (!this.current) return;
    const { action, question } = this.current;
    const correct = index === question.correctIndex;
    if (correct) window.acceptQuizQuestion?.(question);
    else window.releaseQuizQuestion?.(question);
    this.panel.querySelectorAll("[data-answer]").forEach((button) => {
      const answerIndex = Number(button.dataset.answer);
      button.disabled = true;
      button.classList.toggle("correct", answerIndex === question.correctIndex);
      button.classList.toggle("wrong", answerIndex === index && !correct);
    });
    const text = correct ? actionSuccess(action) : actionFailure(action);
    const status = this.panel.querySelector(".action-quiz-status");
    if (status) status.textContent = text;

    window.setTimeout(() => {
      this.panel.hidden = true;
      this.panel.innerHTML = "";
      this.active = false;
      this.current = null;
      this.onActiveChange(false);
      const resolve = this.resolveCurrent;
      this.resolveCurrent = null;
      resolve?.(correct);
    }, correct ? 520 : 900);
  }
}
