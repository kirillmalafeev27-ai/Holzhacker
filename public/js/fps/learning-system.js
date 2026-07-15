import { ActionQuizGate } from "/see-escape/js/action-quiz.js";
import { StoryTreasureMode, STORY_TREASURE_RUNS } from "/see-escape/js/story-treasures.js";


const MODE_KEY = "waldwacht-quiz-mode";
const STORY_KEY = "waldwacht-story-index";
const STORY_TOTAL = 6;
let storiesExpanded = false;

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
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

function safeStorageGet(key, fallback) {
  try { return localStorage.getItem(key) ?? fallback; }
  catch (_) { return fallback; }
}

function safeStorageSet(key, value) {
  try { localStorage.setItem(key, String(value)); }
  catch (_) { /* Private-mode storage failures do not block a game. */ }
}

export function splitStoryFragment(fragment) {
  const text = String(fragment?.text || "").trim();
  const sentences = text.match(/[^.!?]+[.!?]+|[^.!?]+$/g)?.map((part) => part.trim()).filter(Boolean) || [];
  let first;
  let second;
  if (sentences.length >= 2) {
    const splitAt = Math.max(1, Math.ceil(sentences.length / 2));
    first = sentences.slice(0, splitAt).join(" ");
    second = sentences.slice(splitAt).join(" ");
  } else {
    const words = text.split(/\s+/).filter(Boolean);
    const splitAt = Math.max(1, Math.ceil(words.length / 2));
    first = words.slice(0, splitAt).join(" ");
    second = words.slice(splitAt).join(" ");
  }
  if (!second) second = first;
  return [
    { ...fragment, id: `${fragment.id}-part-1`, key: `${fragment.key} · I`, text: first },
    { ...fragment, id: `${fragment.id}-part-2`, key: `${fragment.key} · II`, text: second },
  ];
}

export function expandStoriesToSix(runs = STORY_TREASURE_RUNS) {
  if (storiesExpanded && runs === STORY_TREASURE_RUNS) return runs;
  for (const run of runs) {
    for (const fragments of Object.values(run.levels || {})) {
      if (!Array.isArray(fragments) || fragments.length !== 5) continue;
      fragments.splice(4, 1, ...splitStoryFragment(fragments[4]));
    }
  }
  if (runs === STORY_TREASURE_RUNS) storiesExpanded = true;
  return runs;
}

function rewriteStoryPanel(panel) {
  if (!panel) return;
  const replacements = [
    [/Все пять/gi, "Все шесть"],
    [/все 5/gi, "все 6"],
    [/5 сюжетных/gi, "6 сюжетных"],
    [/Островное задание/gi, "Финальное задание"],
    [/Открыть остров/gi, "Собрать историю"],
    [/острове/gi, "финальном задании"],
    [/островное сокровище/gi, "история"],
    [/Остров скрыт/gi, "История ещё не собрана"],
  ];
  const walker = document.createTreeWalker(panel, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  for (const node of nodes) {
    let next = node.textContent;
    for (const [pattern, value] of replacements) next = next.replace(pattern, value);
    node.textContent = next;
  }
}

class RecallQuizGate {
  constructor({ onActiveChange = null } = {}) {
    this.onActiveChange = onActiveChange || (() => {});
    this.active = false;
    this.questionCounter = 0;
    this.resolveCurrent = null;
    this.panel = document.getElementById("recallQuiz") || document.createElement("section");
    this.panel.id = "recallQuiz";
    this.panel.className = "panel";
    this.panel.hidden = true;
    if (!this.panel.parentNode) document.body.appendChild(this.panel);
    this.panel.addEventListener("pointerdown", (event) => event.stopPropagation());
    this.panel.addEventListener("click", (event) => event.stopPropagation());
  }

  async request(action, context = {}) {
    if (this.active) return false;
    const floor = ++this.questionCounter;
    const quizContext = { floor, ...context };
    await window.quizEnsureQuestionAvailable?.(quizContext);
    const question = normalizeQuestion(window.pickQuestion?.("mix", quizContext));
    if (!question) return false;

    this.active = true;
    this.current = { action, question };
    this.onActiveChange(true);
    this.render(question);
    window.playQuizAudio?.(question, true);
    return new Promise((resolve) => { this.resolveCurrent = resolve; });
  }

  render(question) {
    const translation = question.translation
      ? `<span class="question-translation"><b>Русский перевод:</b> ${escapeHtml(question.translation)}</span>`
      : "";
    const visibleQuestion = question.audioText
      ? `${escapeHtml(question.text || "")}<span>${escapeHtml(question.display || "")}</span>${translation}`
      : `${escapeHtml(question.text || "")}<span>${escapeHtml(question.display || question.q || "")}</span>${translation}`;
    this.panel.innerHTML = `
      <div class="action-quiz-head">
        <b>Тест на воспроизведение</b>
        <span>${escapeHtml(question.topic || question.level || "")}</span>
      </div>
      <div class="action-quiz-question">${visibleQuestion}</div>
      <form class="recall-answer-form">
        <label for="recall-answer">Введите ответ по-немецки</label>
        <div class="recall-answer-row">
          <input id="recall-answer" name="answer" type="text" autocomplete="off" spellcheck="false" maxlength="600" required>
          <button type="submit">Проверить</button>
        </div>
      </form>
      <div class="action-quiz-status" data-recall-status>Напишите ответ самостоятельно — вариантов ответа нет.</div>
      <div class="recall-explanation" data-recall-explanation hidden></div>
      <div class="story-actions" data-recall-actions></div>
    `;
    this.panel.hidden = false;
    const form = this.panel.querySelector("form");
    form?.addEventListener("submit", (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.submit(form.elements.answer.value);
    });
    form?.elements.answer?.focus({ preventScroll: true });
  }

  async submit(rawAnswer) {
    const userAnswer = String(rawAnswer || "").trim();
    if (!userAnswer || !this.current || this.evaluating) return;
    this.evaluating = true;
    const { question } = this.current;
    const expectedAnswer = question.choices[question.correctIndex];
    const status = this.panel.querySelector("[data-recall-status]");
    const input = this.panel.querySelector("input");
    const submit = this.panel.querySelector("button[type=submit]");
    if (input) input.disabled = true;
    if (submit) submit.disabled = true;
    if (status) status.textContent = "ИИ проверяет ответ…";

    let result;
    try {
      const response = await fetch("/api/check-recall-answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: question.text || question.q || "",
          display: question.display || "",
          translation: question.translation || "",
          expectedAnswer,
          userAnswer,
        }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      result = await response.json();
    } catch (_) {
      const normalize = (value) => String(value || "").toLocaleLowerCase("de-DE").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
      const correct = normalize(userAnswer) === normalize(expectedAnswer);
      result = {
        correct,
        correctAnswer: expectedAnswer,
        explanation: correct ? "Ответ совпадает с эталоном." : `Не удалось связаться с ИИ. Эталонный ответ: ${expectedAnswer}`,
      };
    }
    this.evaluating = false;
    this.showResult(result);
  }

  showResult(result) {
    const correct = Boolean(result?.correct);
    if (correct) window.acceptQuizQuestion?.(this.current?.question);
    else window.releaseQuizQuestion?.(this.current?.question);
    const status = this.panel.querySelector("[data-recall-status]");
    if (status) {
      status.textContent = correct ? "Верно. Действие разрешено." : "Ответ неверен.";
      status.classList.toggle("error", !correct);
    }
    if (correct) {
      window.setTimeout(() => this.finish(true), 520);
      return;
    }
    const explanation = this.panel.querySelector("[data-recall-explanation]");
    if (explanation) {
      explanation.hidden = false;
      explanation.innerHTML = `
        <b>Что исправить</b>
        <p>${escapeHtml(result?.explanation || "Ответ не совпадает с требуемой формой.")}</p>
        <span>Правильно: <strong>${escapeHtml(result?.correctAnswer || this.current.question.choices[this.current.question.correctIndex])}</strong></span>
      `;
    }
    const actions = this.panel.querySelector("[data-recall-actions]");
    if (actions) {
      actions.innerHTML = '<button type="button" data-understood>Понял</button>';
      actions.querySelector("[data-understood]")?.addEventListener("click", () => this.finish(false));
      actions.querySelector("[data-understood]")?.focus({ preventScroll: true });
    }
  }

  finish(correct) {
    if (!this.active) return;
    this.panel.hidden = true;
    this.panel.innerHTML = "";
    this.active = false;
    this.current = null;
    this.evaluating = false;
    this.onActiveChange(false);
    const resolve = this.resolveCurrent;
    this.resolveCurrent = null;
    resolve?.(correct);
  }
}

class WaldStoryMode extends StoryTreasureMode {
  constructor(options) {
    super(options);
    this.observer = new MutationObserver(() => rewriteStoryPanel(this.panel));
    this.observer.observe(this.panel, { childList: true, subtree: true });
  }

  progressLabel() {
    return `Собери фрагменты истории ${this.collected}/${this.total}. История ${this.runIndex + 1}/3, уровень ${this.level}.`;
  }

  introLine() {
    return `Собери ${STORY_TOTAL} записок из уничтоженных катапульт и восстанови историю. Уровень: ${this.level}.`;
  }

  warnNeedFragments() {
    this.onMessage(`Нужно собрать все ${this.total} фрагментов: сейчас ${this.collected}/${this.total}.`);
  }
}

export class LearningSystem {
  constructor({ input, toast, onStorySolved } = {}) {
    expandStoriesToSix();
    this.input = input;
    this.toast = toast || (() => {});
    this.pending = false;
    this.mode = safeStorageGet(MODE_KEY, "recognition") === "recall" ? "recall" : "recognition";
    this.storyIndex = Math.max(0, Math.min(2, Number(safeStorageGet(STORY_KEY, "0")) || 0));
    this.recognition = new ActionQuizGate();
    this.recall = new RecallQuizGate();
    this.story = null;
    this.onStorySolved = onStorySolved || (() => {});
    this.setupMenu();
    this.setupStory();
  }

  get active() {
    return Boolean(this.pending || this.recognition.active || this.recall.active || this.story?.active);
  }

  setupMenu() {
    const modeButtons = [...document.querySelectorAll("[data-quiz-mode]")];
    const storyButtons = [...document.querySelectorAll("[data-story-index]")];
    STORY_TREASURE_RUNS.forEach((run, index) => {
      const title = document.querySelector(`[data-story-title="${index}"]`);
      if (title) title.textContent = run.title;
    });
    const render = () => {
      modeButtons.forEach((button) => button.classList.toggle("selected", button.dataset.quizMode === this.mode));
      storyButtons.forEach((button) => button.classList.toggle("selected", Number(button.dataset.storyIndex) === this.storyIndex));
    };
    modeButtons.forEach((button) => button.addEventListener("click", () => {
      this.mode = button.dataset.quizMode === "recall" ? "recall" : "recognition";
      safeStorageSet(MODE_KEY, this.mode);
      render();
    }));
    storyButtons.forEach((button) => button.addEventListener("click", () => {
      this.storyIndex = Math.max(0, Math.min(2, Number(button.dataset.storyIndex) || 0));
      safeStorageSet(STORY_KEY, this.storyIndex);
      render();
    }));
    render();
  }

  setupStory() {
    let story;
    story = new WaldStoryMode({
      onMessage: (message) => this.toast(message, 4200),
      enterCursorMode: () => document.exitPointerLock?.(),
      onRevealIsland: () => queueMicrotask(() => story.handleIslandEntry({ onSolved: (run) => this.onStorySolved(run) })),
      onSolved: (run) => this.onStorySolved(run),
    });
    this.story = story;
    this.configureFromMenu();
  }

  configureFromMenu() {
    this.story?.setRunContext({
      runIndex: this.storyIndex,
      level: window.getSeaQuizSettings?.().level || "A2",
    });
    return { mode: this.mode, storyIndex: this.storyIndex, story: STORY_TREASURE_RUNS[this.storyIndex] };
  }

  prepare(count = 30) {
    return this.recognition.prepare(count);
  }

  async request(action, context = {}) {
    if (this.active) return false;
    this.pending = true;
    document.exitPointerLock?.();
    let correct = false;
    try {
      const gate = this.mode === "recall" ? this.recall : this.recognition;
      correct = Boolean(await gate.request(action, context));
      return correct;
    } catch (error) {
      console.warn("Learning question failed:", error);
      this.toast("Не удалось открыть задание. Попробуйте ещё раз.");
      return false;
    } finally {
      this.pending = false;
      if (!this.story?.active) this.input?.requestLock?.();
    }
  }

  collectStoryFragment() {
    document.exitPointerLock?.();
    return this.story.collect({
      onAfterRead: ({ complete }) => {
        if (!complete && !this.active) this.input?.requestLock?.();
      },
    });
  }

  snapshot() {
    return {
      mode: this.mode,
      storyIndex: this.storyIndex,
      story: this.story?.snapshot?.(),
    };
  }
}
