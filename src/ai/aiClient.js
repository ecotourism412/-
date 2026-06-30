export const USE_REMOTE_AI = true;

const AI_REACTION_ENDPOINT = "/api/ai-reaction";
const REMOTE_TIMEOUT_MS = 9000;
const TEXT_LIMITS = {
  cabbage: 25,
  pig: 10,
  pigKing: 30,
};
const ALLOWED_TONES = new Set(["nervous", "excited", "hurt", "threatening", "absurd", "angry", "sad"]);
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

export async function requestAIReaction({ decision, snapshot, fallbackResponse }) {
  if (!USE_REMOTE_AI) {
    return fallbackResponse;
  }

  try {
    const response = await requestWithTimeout(AI_REACTION_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        eventType: decision?.eventType,
        speakerType: decision?.speakerType,
        gameSnapshot: snapshot,
        recentDialogue: snapshot?.context?.recentDialogue ?? [],
        priority: decision?.priority,
        toneHint: decision?.toneHint,
        intentHint: decision?.intentHint,
        emotionHint: decision?.emotionHint,
        interrupt: decision?.interrupt,
        canBeDropped: decision?.canBeDropped,
        delayMs: decision?.delayMs,
        avoidTexts: snapshot?.context?.avoidTexts ?? [],
      }),
    });

    if (!response.ok) {
      return fallbackResponse;
    }

    const body = await response.json();
    const reaction = body?.reaction ?? body;
    return isUsableAIResponse(reaction, decision?.speakerType) ? reaction : fallbackResponse;
  } catch {
    return fallbackResponse;
  }
}

async function requestWithTimeout(url, options) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REMOTE_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function isUsableAIResponse(response, expectedSpeaker) {
  if (!response || typeof response !== "object") {
    return false;
  }
  if (response.speaker !== expectedSpeaker) {
    return false;
  }
  const text = typeof response.text === "string" ? response.text.trim() : "";
  if (!text || !/[\u3400-\u9fff]/.test(text) || /[\r\n]/.test(text)) {
    return false;
  }
  if (Array.from(text).length > (TEXT_LIMITS[response.speaker] ?? 0)) {
    return false;
  }
  if (response.intent && !ALLOWED_INTENTS.has(response.intent)) {
    return false;
  }
  if (response.emotion && !ALLOWED_EMOTIONS.has(response.emotion)) {
    return false;
  }
  return (
    ALLOWED_TONES.has(response.tone) &&
    [1, 2, 3].includes(response.priority) &&
    Number.isFinite(response.ttl) &&
    typeof response.shouldSpeak === "boolean" &&
    response.shouldVoice === false &&
    typeof response.voiceStyle === "string"
  );
}
