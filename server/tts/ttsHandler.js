import { synthesizeDoubaoTTS } from "./doubaoTtsClient.js";

const ALLOWED_SPEAKERS = new Set(["cabbage", "cabbageSpirit", "pig", "pigKing"]);
const TEXT_LIMITS = {
  cabbage: 25,
  cabbageSpirit: 25,
  pig: 10,
  pigKing: 30,
};

export async function createTTSResponse(requestBody) {
  const request = normalizeTTSRequest(requestBody);
  if (!request.ok) {
    return {
      ok: true,
      skipped: true,
      reason: request.reason,
    };
  }

  try {
    return await synthesizeDoubaoTTS(request.value);
  } catch (error) {
    console.warn("[tts] Doubao TTS failed:", error.message);
    return {
      ok: true,
      skipped: true,
      reason: "tts_failed",
    };
  }
}

export async function handleTTSRequest(request) {
  if (request.method !== "POST") {
    return jsonResponse({ ok: false, error: "Method not allowed" }, 405);
  }

  try {
    const body = await request.json();
    const result = await createTTSResponse(body);
    return jsonResponse(result, 200);
  } catch (error) {
    return jsonResponse({ ok: false, error: error.message || "TTS request failed" }, 400);
  }
}

export default async function ttsHandler(req, res) {
  if (req.method && req.method !== "POST") {
    res.statusCode = 405;
    res.setHeader("content-type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ ok: false, error: "Method not allowed" }));
    return;
  }

  try {
    const body = await readNodeRequestBody(req);
    const result = await createTTSResponse(body);
    res.statusCode = 200;
    res.setHeader("content-type", "application/json; charset=utf-8");
    res.end(JSON.stringify(result));
  } catch (error) {
    res.statusCode = 400;
    res.setHeader("content-type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ ok: false, error: error.message || "TTS request failed" }));
  }
}

function normalizeTTSRequest(body = {}) {
  const speaker = normalizeSpeaker(body.speaker);
  if (!ALLOWED_SPEAKERS.has(speaker)) {
    return { ok: false, reason: "speaker_not_voice_enabled" };
  }

  const text = sanitizeText(body.text);
  if (!text) {
    return { ok: false, reason: "empty_text" };
  }

  const limit = TEXT_LIMITS[speaker] ?? 20;
  const clippedText = Array.from(text).slice(0, limit).join("");
  if (!/[\u3400-\u9fff]/.test(clippedText)) {
    return { ok: false, reason: "text_not_chinese" };
  }

  return {
    ok: true,
    value: {
      speaker,
      text: clippedText,
      tone: typeof body.tone === "string" ? body.tone : "neutral",
      priority: [1, 2, 3].includes(body.priority) ? body.priority : 1,
    },
  };
}

function normalizeSpeaker(speaker) {
  if (speaker === "cabbageSpirit") {
    return "cabbage";
  }
  return typeof speaker === "string" ? speaker : "";
}

function sanitizeText(text) {
  if (typeof text !== "string") {
    return "";
  }
  return text
    .replace(/[`*_#>\[\]{}<>]/g, "")
    .replace(/\s+/g, "")
    .trim();
}

function jsonResponse(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

async function readNodeRequestBody(req) {
  if (req.body && typeof req.body === "object") {
    return req.body;
  }

  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  const rawBody = Buffer.concat(chunks).toString("utf8");
  return rawBody ? JSON.parse(rawBody) : {};
}
