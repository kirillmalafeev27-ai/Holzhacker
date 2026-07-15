const DEFAULT_MODELS = 'gpt-5.4';
const AI_TIMEOUT_MS = Number(process.env.AI_TIMEOUT_MS || 45_000);

function aiKey() {
  return process.env.AITUNNEL_API_KEY ||
    process.env.AI_TUNNEL_API_KEY ||
    process.env.AITUNNEL_TOKEN ||
    process.env.OPENAI_API_KEY ||
    process.env.AI_API_KEY ||
    '';
}

function usesAiTunnel() {
  return Boolean(process.env.AITUNNEL_API_KEY || process.env.AI_TUNNEL_API_KEY || process.env.AITUNNEL_TOKEN);
}

function aiBaseUrl() {
  const configured = process.env.AI_BASE_URL || process.env.OPENAI_BASE_URL;
  if (configured) return configured.replace(/\/$/, '');
  return usesAiTunnel() ? 'https://api.aitunnel.ru/v1' : 'https://api.openai.com/v1';
}

function aiModels() {
  return (process.env.AI_MODELS || process.env.AITUNNEL_MODELS || process.env.OPENAI_MODELS ||
    process.env.AI_MODEL || process.env.AITUNNEL_MODEL || process.env.OPENAI_MODEL || DEFAULT_MODELS)
    .split(',').map((model) => model.trim()).filter(Boolean);
}

function normalizeAnswer(value) {
  return String(value || '')
    .normalize('NFKC')
    .toLocaleLowerCase('de-DE')
    // German keyboard fallback: umlauts and their two-letter spellings are
    // equivalent in free-text answers.
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/[„“”"'`´.,!?;:()[\]{}]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function jsonFromText(text) {
  const source = String(text || '').trim();
  try { return JSON.parse(source); } catch (_) {
    const match = source.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try { return JSON.parse(match[0]); } catch (_) { return null; }
  }
}

async function requestAiEvaluation(payload) {
  const key = aiKey();
  if (!key) return null;
  const prompt = [
    'Ты проверяешь свободный ответ ученика по немецкому языку.',
    'Учитывай смысл, грамматику и требуемую форму. Не считай ошибками регистр, лишние пробелы и необязательную пунктуацию.',
    'Считай ä и ae, ö и oe, ü и ue полностью равноправными вариантами написания. Никогда не отмечай такую замену как ошибку.',
    'Заданный русский перевод — обязательная целевая мысль. Не принимай грамматически верный ответ, если он меняет смысл перевода.',
    'Если ответ неверен, коротко и конкретно объясни по-русски, что именно не так и как ответить правильно. Обязательно напиши, как должно переводиться полное правильное предложение на русский.',
    'Верни только JSON: {"correct":boolean,"explanation":"...","correctAnswer":"..."}.',
    `Задание: ${payload.question}`,
    `Контекст на экране: ${payload.display}`,
    `Целевой русский перевод: ${payload.translation || 'не указан'}`,
    `Эталонный ответ: ${payload.expectedAnswer}`,
    `Ответ ученика: ${payload.userAnswer}`,
  ].join('\n');

  const errors = [];
  for (const model of aiModels()) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);
    try {
      const response = await fetch(`${aiBaseUrl()}/chat/completions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          max_tokens: 700,
          messages: [{ role: 'user', content: prompt }],
        }),
        signal: controller.signal,
      });
      const raw = await response.text();
      if (!response.ok) {
        errors.push(`${model}: HTTP ${response.status}`);
        continue;
      }
      const body = JSON.parse(raw);
      const parsed = jsonFromText(body.choices?.[0]?.message?.content);
      if (parsed && typeof parsed.correct === 'boolean') {
        return {
          correct: parsed.correct,
          explanation: String(parsed.explanation || '').trim(),
          correctAnswer: String(parsed.correctAnswer || payload.expectedAnswer).trim(),
          evaluator: 'ai',
        };
      }
      errors.push(`${model}: invalid JSON`);
    } catch (error) {
      errors.push(`${model}: ${error?.name === 'AbortError' ? 'timeout' : error?.message || error}`);
    } finally {
      clearTimeout(timeout);
    }
  }
  console.warn(`Recall AI evaluation failed: ${errors.join(' | ')}`);
  return null;
}

function localEvaluation(userAnswer, expectedAnswer) {
  const correct = normalizeAnswer(userAnswer) === normalizeAnswer(expectedAnswer);
  return {
    correct,
    explanation: correct
      ? 'Ответ совпадает с эталоном.'
      : `В ответе не совпадает нужная немецкая форма. Правильный вариант: ${expectedAnswer}`,
    correctAnswer: expectedAnswer,
    evaluator: 'local-fallback',
  };
}

function installRecallRoutes(app) {
  app.post('/api/check-recall-answer', async (req, res) => {
    const question = String(req.body?.question || '').trim().slice(0, 1400);
    const display = String(req.body?.display || '').trim().slice(0, 1400);
    const translation = String(req.body?.translation || '').trim().slice(0, 1400);
    const expectedAnswer = String(req.body?.expectedAnswer || '').trim().slice(0, 600);
    const userAnswer = String(req.body?.userAnswer || '').trim().slice(0, 600);
    if (!expectedAnswer || !userAnswer) return res.status(400).json({ error: 'expectedAnswer and userAnswer are required' });

    const exact = localEvaluation(userAnswer, expectedAnswer);
    if (exact.correct) return res.json(exact);
    const aiResult = await requestAiEvaluation({ question, display, translation, expectedAnswer, userAnswer });
    res.json(aiResult || exact);
  });
}

module.exports = { installRecallRoutes, normalizeAnswer, localEvaluation };
