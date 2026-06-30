import { createReactionPlan } from "../ai/aiAdapter.js";
import { maybeSpeakBark } from "../audio/ttsClient.js";
import { recordDialogue } from "../ai/aiScheduler.js";
import { enqueueBark } from "./dialogueState.js";

export function emitGameEvent(runtime, type, payload = {}) {
  const game = runtime.game;
  const event = {
    type,
    payload: sanitizePayload(payload),
  };

  const plan = createReactionPlan(runtime, event);
  if (!plan) {
    return null;
  }

  markDialogueAttempt(game, type, payload);

  for (const asyncReaction of plan.asyncReactions ?? []) {
    asyncReaction
      .then((reaction) => {
        enqueueDialogueReaction(runtime, reaction);
      })
      .catch(() => {});
  }

  let lastBark = null;
  for (const reaction of plan.reactions ?? []) {
    lastBark = enqueueDialogueReaction(runtime, reaction) ?? lastBark;
  }
  return lastBark;
}

function markDialogueAttempt(game, type, payload) {
  if (payload.pigId) {
    const pig = game.pigs.find((item) => item.id === payload.pigId);
    if (pig) {
      pig.lastBarkAt = game.time;
    }
  }

  if (type.startsWith("boss_")) {
    game.boss.lastThreatAt = game.time;
  }
}

export function enqueueDialogueReaction(runtime, reaction) {
  if (!reaction) {
    return null;
  }
  if (Number.isFinite(reaction.delayMs) && reaction.delayMs > 0) {
    window.setTimeout(() => {
      enqueueDialogueReactionNow(runtime, reaction);
    }, reaction.delayMs);
    return null;
  }
  return enqueueDialogueReactionNow(runtime, reaction);
}

function enqueueDialogueReactionNow(runtime, reaction) {
  const game = runtime.game;
  const bark = enqueueBark(game.dialogue, reaction);
  if (bark) {
    recordDialogue(runtime, bark);
    maybeSpeakBark(runtime, bark);
  }
  return bark;
}

function sanitizePayload(payload) {
  return {
    wave: payload.wave,
    hp: payload.hp,
    bossHpRatio: payload.bossHpRatio,
    pigId: payload.pigId,
    personality: payload.personality,
    critical: Boolean(payload.critical),
    score: payload.score,
    source: payload.source,
  };
}
