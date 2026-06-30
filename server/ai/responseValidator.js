const ALLOWED_SPEAKERS = new Set(["cabbage", "pig", "pigKing"]);
const ALLOWED_TONES = new Set([
  "nervous",
  "excited",
  "hurt",
  "threatening",
  "absurd",
  "angry",
  "sad",
]);
const ALLOWED_PRIORITIES = new Set([1, 2, 3]);
const ALLOWED_INTENTS = new Set([
  "warn",
  "encourage",
  "taunt",
  "panic",
  "celebrate",
  "banter_reply",
  "chat_reply",
]);
const ALLOWED_EMOTIONS = new Set(["nervous", "excited", "hurt", "angry", "sad", "teasing", "scared"]);
const TEXT_LIMITS = {
  cabbage: 25,
  pig: 10,
  pigKing: 30,
};
const INVALID_TEXT_PATTERNS = [
  /```/,
  /^#{1,6}\s/,
  /(^|\n)\s*[-*]\s+/,
  /作为(一个)?AI/,
  /我不能/,
  /以下是/,
  /系统检测/,
  /血量/,
  /生命值/,
  /伤害数值/,
  /markdown/i,
  /json/i,
  /system/i,
];

export function validateAIResponse(response, options = {}) {
  if (!response || typeof response !== "object") {
    return invalid("response must be an object");
  }

  const role = options.role ?? {};
  const defaults = role.outputDefaults ?? {};
  const expectedSpeaker = options.expectedSpeaker ?? role.speaker;
  const speaker = response.speaker ?? defaults.speaker;
  if (!ALLOWED_SPEAKERS.has(speaker)) {
    return invalid("speaker is unsupported");
  }
  if (expectedSpeaker && speaker !== expectedSpeaker) {
    return invalid("speaker does not match request");
  }

  const text = normalizeText(response.text);
  if (!text || !hasChinese(text) || hasLineBreak(text) || looksLikeExplanation(text)) {
    return invalid("text must be a Chinese short sentence");
  }

  const limitedText = enforceTextLimit(text, TEXT_LIMITS[speaker]);
  if (!limitedText) {
    return invalid("text is too long");
  }
  if (isTooSimilarToAny(limitedText, options.avoidTexts)) {
    return invalid("text repeats recent dialogue");
  }
  if (isTooSimilarToAny(limitedText, options.styleReferences)) {
    return invalid("text copies style reference");
  }

  const intent = ALLOWED_INTENTS.has(response.intent)
    ? response.intent
    : options.expectedIntent ?? defaults.intent ?? "encourage";
  if (!ALLOWED_INTENTS.has(intent)) {
    return invalid("intent is unsupported");
  }

  const emotion = ALLOWED_EMOTIONS.has(response.emotion)
    ? response.emotion
    : options.expectedEmotion ?? defaults.emotion ?? defaults.tone;
  if (!ALLOWED_EMOTIONS.has(emotion)) {
    return invalid("emotion is unsupported");
  }

  const tone = ALLOWED_TONES.has(response.tone)
    ? response.tone
    : options.expectedTone ?? defaults.tone;
  if (!ALLOWED_TONES.has(tone)) {
    return invalid("tone is unsupported");
  }

  const priority = options.expectedPriority ?? (Number.isFinite(response.priority) ? response.priority : defaults.priority);
  if (!ALLOWED_PRIORITIES.has(priority)) {
    return invalid("priority is unsupported");
  }

  const ttl = Number.isFinite(response.ttl) ? response.ttl : defaults.ttl;
  if (!Number.isFinite(ttl)) {
    return invalid("ttl must be a number");
  }

  const voiceStyle = response.voiceStyle ?? defaults.voiceStyle;
  if (typeof voiceStyle !== "string" || !voiceStyle.trim()) {
    return invalid("voiceStyle must be a string");
  }

  return {
    ok: true,
    value: {
      speaker,
      text: limitedText,
      intent,
      emotion,
      tone,
      priority,
      ttl,
      shouldSpeak: typeof response.shouldSpeak === "boolean" ? response.shouldSpeak : true,
      shouldVoice: false,
      voiceStyle,
      interrupt: Boolean(response.interrupt ?? defaults.interrupt),
      canBeDropped: Boolean(response.canBeDropped ?? defaults.canBeDropped),
      delayMs: Number.isFinite(response.delayMs) ? response.delayMs : defaults.delayMs ?? 0,
    },
  };
}

export function isValidAIResponse(response, options) {
  return validateAIResponse(response, options).ok;
}

function invalid(error) {
  return { ok: false, error };
}

function normalizeText(text) {
  return typeof text === "string" ? text.trim() : "";
}

function hasChinese(text) {
  return /[\u3400-\u9fff]/.test(text);
}

function hasLineBreak(text) {
  return /[\r\n]/.test(text);
}

function looksLikeExplanation(text) {
  if (INVALID_TEXT_PATTERNS.some((pattern) => pattern.test(text))) {
    return true;
  }
  const chineseCount = (text.match(/[\u3400-\u9fff]/g) ?? []).length;
  const latinCount = (text.match(/[A-Za-z]/g) ?? []).length;
  return latinCount > 8 && latinCount > chineseCount;
}

function enforceTextLimit(text, limit) {
  const chars = Array.from(text);
  if (chars.length <= limit) {
    return text;
  }

  const overflow = chars.length - limit;
  if (overflow <= 6) {
    return chars.slice(0, limit).join("");
  }
  return "";
}

function isTooSimilarToAny(text, candidates) {
  if (!Array.isArray(candidates) || !candidates.length) {
    return false;
  }
  return candidates.some((candidate) => areTooSimilar(text, candidate));
}

function areTooSimilar(left, right) {
  const a = normalizeForSimilarity(left);
  const b = normalizeForSimilarity(right);
  if (!a || !b) {
    return false;
  }
  if (a === b) {
    return true;
  }
  const minLength = Math.min(a.length, b.length);
  if (minLength >= 5 && (a.includes(b) || b.includes(a))) {
    return true;
  }
  if (minLength < 5) {
    return false;
  }
  return jaccard(bigrams(a), bigrams(b)) >= 0.72;
}

function normalizeForSimilarity(text) {
  return String(text || "")
    .replace(/[，。！？、,.!?…：:；;“”"'`~\s]/g, "")
    .trim();
}

function bigrams(text) {
  const chars = Array.from(text);
  if (chars.length < 2) {
    return new Set(chars);
  }
  const result = new Set();
  for (let i = 0; i < chars.length - 1; i += 1) {
    result.add(`${chars[i]}${chars[i + 1]}`);
  }
  return result;
}

function jaccard(left, right) {
  if (!left.size || !right.size) {
    return 0;
  }
  let intersection = 0;
  for (const item of left) {
    if (right.has(item)) {
      intersection += 1;
    }
  }
  return intersection / (left.size + right.size - intersection);
}
