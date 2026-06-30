import { callModelForRole } from "./callModelForRole.js";
import { buildPromptForRole } from "./prompts/buildPromptForRole.js";
import { validateAIResponse } from "./responseValidator.js";
import { getFallbackReaction } from "../../src/ai/fallbackReactions.zh.js";

const CHAT_EVENT = "PLAYER_CHAT";
const MAX_CHAT_CHARS = 80;

export async function createAIChatResponse(requestBody) {
  const request = normalizeChatRequest(requestBody);
  if (!request.message) {
    return { ok: false, error: "message is required" };
  }

  const reactions = [];
  const sources = [];
  const cabbage = await createChatReaction({
    request,
    speakerType: "cabbage",
    toneHint: "nervous",
    intentHint: "chat_reply",
    emotionHint: "nervous",
    priority: 2,
    delayMs: 0,
  });
  if (cabbage.reaction) {
    reactions.push(cabbage.reaction);
    sources.push(cabbage.source);
  }

  if (shouldSummonPigKing(request)) {
    const pigKing = await createChatReaction({
      request: {
        ...request,
        recentDialogue: [
          ...request.recentDialogue,
          ...(cabbage.reaction
            ? [{ speaker: cabbage.reaction.speaker, text: cabbage.reaction.text }]
            : []),
        ],
        avoidTexts: [...request.avoidTexts, ...(cabbage.reaction?.text ? [cabbage.reaction.text] : [])],
      },
      speakerType: "pigKing",
      toneHint: "threatening",
      intentHint: "taunt",
      emotionHint: "angry",
      priority: 3,
      delayMs: 900,
    });
    if (pigKing.reaction) {
      reactions.push(pigKing.reaction);
      sources.push(pigKing.source);
    }
  }

  return {
    ok: true,
    source: sources.every((source) => source === "fallback") ? "fallback" : "remote",
    reactions,
  };
}

export async function handleAIChatRequest(request) {
  if (request.method !== "POST") {
    return jsonResponse({ ok: false, error: "Method not allowed" }, 405);
  }

  try {
    const body = await request.json();
    const result = await createAIChatResponse(body);
    return jsonResponse(result, result.ok ? 200 : 400);
  } catch (error) {
    return jsonResponse({ ok: false, error: error.message || "AI chat failed" }, 400);
  }
}

export default async function aiChatHandler(req, res) {
  if (req.method && req.method !== "POST") {
    res.statusCode = 405;
    res.setHeader("content-type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ ok: false, error: "Method not allowed" }));
    return;
  }

  try {
    const body = await readNodeRequestBody(req);
    const result = await createAIChatResponse(body);
    res.statusCode = result.ok ? 200 : 400;
    res.setHeader("content-type", "application/json; charset=utf-8");
    res.end(JSON.stringify(result));
  } catch (error) {
    res.statusCode = 400;
    res.setHeader("content-type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ ok: false, error: error.message || "AI chat failed" }));
  }
}

async function createChatReaction({
  request,
  speakerType,
  toneHint,
  intentHint,
  emotionHint,
  priority,
  delayMs,
}) {
  const promptBundle = await buildPromptForRole({
    eventType: CHAT_EVENT,
    speakerType,
    gameSnapshot: request.gameSnapshot,
    recentDialogue: request.recentDialogue,
    toneHint,
    intentHint,
    emotionHint,
    priority,
    avoidTexts: request.avoidTexts,
    playerMessage: request.message,
  });
  const role = promptBundle.role;

  try {
    const rawResponse = await callModelForRole(role, promptBundle, request);
    const validation = validateAIResponse(rawResponse, {
      expectedSpeaker: speakerType,
      expectedTone: toneHint,
      expectedIntent: intentHint,
      expectedEmotion: emotionHint,
      expectedPriority: priority,
      avoidTexts: request.avoidTexts,
      styleReferences: promptBundle.styleReferences,
      role,
    });
    if (!validation.ok) {
      throw new Error(`Invalid AI chat response: ${validation.error}`);
    }
    return {
      source: "remote",
      reaction: {
        ...validation.value,
        interrupt: speakerType === "pigKing",
        canBeDropped: false,
        delayMs,
      },
    };
  } catch (error) {
    console.warn("[aiChat] remote failed, using fallback:", error.message);
    return {
      source: "fallback",
      reaction: buildChatFallback({
        role,
        request,
        speakerType,
        toneHint,
        intentHint,
        emotionHint,
        priority,
        delayMs,
      }),
    };
  }
}

function buildChatFallback({
  role,
  request,
  speakerType,
  toneHint,
  intentHint,
  emotionHint,
  priority,
  delayMs,
}) {
  const decision = {
    shouldRequestAI: true,
    eventType: CHAT_EVENT,
    speakerType,
    priority,
    toneHint,
    intentHint,
    emotionHint,
    interrupt: speakerType === "pigKing",
    canBeDropped: false,
    delayMs,
  };
  const fallback = getFallbackReaction(decision, withAvoidTexts(request.gameSnapshot, request.avoidTexts));
  const validation = validateAIResponse(fallback, {
    expectedSpeaker: speakerType,
    expectedTone: toneHint,
    expectedIntent: intentHint,
    expectedEmotion: emotionHint,
    expectedPriority: priority,
    avoidTexts: request.avoidTexts,
    styleReferences: role.examples?.[CHAT_EVENT] ?? [],
    role,
  });
  if (validation.ok) {
    return {
      ...validation.value,
      interrupt: speakerType === "pigKing",
      canBeDropped: false,
      delayMs,
    };
  }

  return {
    ...role.outputDefaults,
    text: speakerType === "pigKing" ? "猪王听见了。" : "我听见了，我在。",
    shouldVoice: false,
    delayMs,
  };
}

function normalizeChatRequest(body = {}) {
  const message = sanitizeMessage(body.message);
  const gameSnapshot = body.gameSnapshot && typeof body.gameSnapshot === "object" ? body.gameSnapshot : {};
  const recentDialogue = Array.isArray(body.recentDialogue) ? body.recentDialogue.slice(-8) : [];
  const chatHistory = Array.isArray(body.chatHistory) ? body.chatHistory.slice(-10) : [];
  const avoidTexts = Array.isArray(body.avoidTexts)
    ? body.avoidTexts.slice(-12)
    : gameSnapshot?.context?.avoidTexts ?? [];
  return {
    message,
    gameSnapshot: {
      ...gameSnapshot,
      chat: {
        history: chatHistory,
      },
    },
    recentDialogue,
    chatHistory,
    avoidTexts,
  };
}

function sanitizeMessage(message) {
  if (typeof message !== "string") {
    return "";
  }
  return Array.from(message.replace(/\s+/g, " ").trim()).slice(0, MAX_CHAT_CHARS).join("");
}

function shouldSummonPigKing(request) {
  const message = request.message;
  if (!/(猪王|boss|Boss|BOSS|回话|对骂|嘲讽|挑衅|怼|骂它|让它说)/.test(message)) {
    return false;
  }
  const boss = request.gameSnapshot?.boss ?? {};
  const bossAlive = Number.isFinite(boss.hpRatio)
    ? boss.hpRatio > 0
    : boss.phase && !["idle", "dead"].includes(boss.phase);
  const recentBossEvent = (request.gameSnapshot?.context?.recentEvents ?? []).some((event) =>
    String(event?.type ?? "").startsWith("boss_")
  );
  return Boolean(bossAlive || recentBossEvent);
}

function withAvoidTexts(snapshot, avoidTexts) {
  return {
    ...(snapshot ?? {}),
    context: {
      ...(snapshot?.context ?? {}),
      avoidTexts,
    },
  };
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
