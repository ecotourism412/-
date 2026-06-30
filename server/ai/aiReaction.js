import { callModelForRole } from "./callModelForRole.js";
import { buildPromptForRole } from "./prompts/buildPromptForRole.js";
import { validateAIResponse } from "./responseValidator.js";
import { getFallbackReaction } from "../../src/ai/fallbackReactions.zh.js";

export async function createAIReaction(requestBody) {
  const request = normalizeRequest(requestBody);
  const promptBundle = await buildPromptForRole({
    eventType: request.eventType,
    speakerType: request.speakerType,
    gameSnapshot: request.gameSnapshot,
    recentDialogue: request.recentDialogue,
    toneHint: request.toneHint,
    intentHint: request.intentHint,
    emotionHint: request.emotionHint,
    priority: request.priority,
    avoidTexts: request.avoidTexts,
  });
  const role = promptBundle.role;

  try {
    const rawResponse = await callModelForRole(role, promptBundle, request);
    const validation = validateAIResponse(rawResponse, {
      expectedSpeaker: request.speakerType,
      expectedTone: request.toneHint ?? role.eventToneHints?.[request.eventType],
      expectedIntent: request.intentHint,
      expectedEmotion: request.emotionHint,
      expectedPriority: request.priority,
      avoidTexts: request.avoidTexts,
      styleReferences: promptBundle.styleReferences,
      role,
    });
    if (!validation.ok) {
      throw new Error(`Invalid AI response: ${validation.error}`);
    }

    return {
      ok: true,
      source: "remote",
      reaction: validation.value,
    };
  } catch (error) {
    console.warn("[aiReaction] remote failed, using fallback:", error.message);
    return {
      ok: true,
      source: "fallback",
      reason: "remote_failed",
      reaction: buildFallbackReaction(role, request),
    };
  }
}

export async function handleAIReactionRequest(request) {
  if (request.method !== "POST") {
    return jsonResponse({ ok: false, error: "Method not allowed" }, 405);
  }

  try {
    const body = await request.json();
    const result = await createAIReaction(body);
    return jsonResponse(result, 200);
  } catch (error) {
    return jsonResponse({ ok: false, error: error.message || "AI reaction failed" }, 400);
  }
}

export default async function aiReactionHandler(req, res) {
  if (req.method && req.method !== "POST") {
    res.statusCode = 405;
    res.setHeader("content-type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ ok: false, error: "Method not allowed" }));
    return;
  }

  try {
    const body = await readNodeRequestBody(req);
    const result = await createAIReaction(body);
    res.statusCode = 200;
    res.setHeader("content-type", "application/json; charset=utf-8");
    res.end(JSON.stringify(result));
  } catch (error) {
    res.statusCode = 400;
    res.setHeader("content-type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ ok: false, error: error.message || "AI reaction failed" }));
  }
}

function normalizeRequest(body = {}) {
  return {
    eventType: body.eventType ?? null,
    speakerType: body.speakerType ?? null,
    gameSnapshot: body.gameSnapshot ?? null,
    recentDialogue: Array.isArray(body.recentDialogue) ? body.recentDialogue : [],
    priority: body.priority,
    toneHint: body.toneHint,
    intentHint: body.intentHint,
    emotionHint: body.emotionHint,
    interrupt: body.interrupt,
    canBeDropped: body.canBeDropped,
    delayMs: body.delayMs,
    avoidTexts: Array.isArray(body.avoidTexts) ? body.avoidTexts : [],
  };
}

function buildFallbackReaction(role, request) {
  const decision = {
    shouldRequestAI: true,
    eventType: request.eventType,
    speakerType: request.speakerType,
    priority: request.priority ?? role.outputDefaults?.priority ?? 1,
    toneHint: request.toneHint ?? role.eventToneHints?.[request.eventType] ?? role.outputDefaults?.tone,
    intentHint: request.intentHint ?? role.outputDefaults?.intent,
    emotionHint: request.emotionHint ?? role.outputDefaults?.emotion,
    interrupt: Boolean(request.interrupt ?? role.outputDefaults?.interrupt),
    canBeDropped: Boolean(request.canBeDropped ?? role.outputDefaults?.canBeDropped),
    delayMs: Number.isFinite(request.delayMs) ? request.delayMs : role.outputDefaults?.delayMs ?? 0,
  };

  const fallback = getFallbackReaction(decision, request.gameSnapshot);
  const validation = validateAIResponse(fallback, {
    expectedSpeaker: request.speakerType,
    expectedTone: request.toneHint ?? role.eventToneHints?.[request.eventType],
    expectedIntent: request.intentHint,
    expectedEmotion: request.emotionHint,
    expectedPriority: request.priority,
    avoidTexts: request.avoidTexts,
    styleReferences: role.examples?.[request.eventType] ?? [],
    role,
  });
  if (validation.ok) {
    return validation.value;
  }

  return {
    ...role.outputDefaults,
    text: lastResortText(request.speakerType),
    shouldVoice: false,
  };
}

function lastResortText(speakerType) {
  if (speakerType === "pigKing") {
    return "猪王还没认输。";
  }
  if (speakerType === "pig") {
    return "别追我！";
  }
  return "我还在你旁边。";
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
