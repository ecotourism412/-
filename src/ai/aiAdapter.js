import { requestAIReaction, USE_REMOTE_AI } from "./aiClient.js";
import { applyVoicePolicy } from "../audio/voicePolicy.js";
import { scheduleAIReaction } from "./aiScheduler.js";
import { buildAISnapshot } from "./buildAISnapshot.js";
import { getFallbackReaction } from "./fallbackReactions.zh.js";

export function createReactionPlan(runtime, event) {
  try {
    const decision = scheduleAIReaction(runtime, event);
    if (!decision?.shouldRequestAI) {
      return null;
    }

    const decisions = [decision, ...(Array.isArray(decision.followUps) ? decision.followUps : [])];
    const planned = decisions
      .map((item) => buildPlannedReaction(runtime, event, item))
      .filter(Boolean);
    if (!planned.length) {
      return null;
    }

    if (!USE_REMOTE_AI) {
      return {
        reactions: planned.map((item) => normalizeBark(item.fallbackResponse, item.decision)).filter(Boolean),
        asyncReactions: [],
      };
    }

    return {
      reactions: [],
      asyncReactions: planned.map((item) =>
        requestAIReaction({
          decision: item.decision,
          snapshot: item.snapshot,
          fallbackResponse: item.fallbackResponse,
        }).then((response) => normalizeBark(response, item.decision))
      ),
    };
  } catch {
    return null;
  }
}

export function getReaction(runtime, event) {
  const plan = createReactionPlan(runtime, event);
  if (!plan) {
    return null;
  }
  return plan.reactions?.[0] ?? null;
}

export function getGameSnapshot(game) {
  return {
    time: game.time,
    wave: game.wave,
    encounterType: game.encounterType,
    score: game.score,
    kills: game.kills,
    playerHp: game.player.hp,
    playerMaxHp: game.player.maxHp,
    pigCount: game.pigs.length,
    bossActive: game.boss.active,
    bossHpRatio: game.boss.maxHp > 0 ? game.boss.hp / game.boss.maxHp : 0,
  };
}

function buildPlannedReaction(runtime, event, decision) {
  const snapshot = buildAISnapshot(runtime, event, decision);
  const fallbackResponse = getFallbackReaction(decision, snapshot);
  if (!fallbackResponse) {
    return null;
  }
  return { decision, snapshot, fallbackResponse };
}

export function normalizeBark(response, decision = {}) {
  if (!response?.shouldSpeak || !response.text) {
    return null;
  }

  return applyVoicePolicy({
    speaker: response.speaker,
    text: response.text,
    intent: response.intent,
    emotion: response.emotion,
    tone: response.tone,
    priority: response.priority,
    ttl: Number.isFinite(response.ttl) ? response.ttl / 1000 : 2.8,
    eventType: response.eventType ?? decision.eventType ?? "",
    sourceType: response.sourceType ?? decision.sourceType ?? "",
    voiceSlot: response.voiceSlot ?? decision.voiceSlot ?? "",
    voiceStyle: response.voiceStyle,
    interrupt: response.interrupt,
    canBeDropped: response.canBeDropped,
    delayMs: response.delayMs,
    forceVoice: response.forceVoice,
  });
}
