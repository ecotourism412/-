const PIG_BARK_WINDOW_SECONDS = 60;
const PIG_BARK_LIMIT = 6;
const PIG_HIT_COOLDOWN_SECONDS = 8;
const CABBAGE_KILL_COOLDOWN_SECONDS = 2.2;
const PLAYER_DAMAGED_COOLDOWN_SECONDS = 2.6;
const COMBO_WINDOW_SECONDS = 3.5;
const COMBO_HIT_COUNT = 3;
const AVOID_TEXT_LIMIT = 18;
const DRAMATIC_MOMENT_LIMIT = 8;

const EVENT_MAP = {
  wave_started: "WAVE_STARTED",
  pig_hit: "PIG_HIT",
  pig_dodged: "PIG_DODGE",
  pig_killed: "PIG_DEATH",
  player_damaged: "PLAYER_DAMAGED",
  player_low_hp: "PLAYER_LOW_HP",
  boss_intro: "BOSS_ENTER",
  boss_half_hp: "BOSS_HALF_HP",
  boss_charge_prepare: "BOSS_CHARGE",
  boss_stomp_prepare: "BOSS_CHARGE",
  boss_low_hp: "BOSS_LOW_HP",
  boss_killed: "BOSS_DEATH",
  game_over: "GAME_OVER",
};

export function scheduleAIReaction(runtime, event) {
  const game = runtime?.game;
  if (!game || !event?.type) {
    return null;
  }

  ensureAIState(game);
  recordRecentEvent(game, event);

  const semanticEvent = EVENT_MAP[event.type] ?? event.type;
  const now = Number.isFinite(game.time) ? game.time : 0;

  if (event.type === "pig_hit") {
    return schedulePigHit(game, event, semanticEvent, now);
  }

  if (event.type === "pig_dodged") {
    if (!allowPigBark(game, now)) {
      return null;
    }
    return createDecision("PIG_DODGE", "pig", 1, "absurd", {
      sourceType: event.type,
      intentHint: "taunt",
      emotionHint: "teasing",
      canBeDropped: true,
    });
  }

  if (event.type === "pig_killed") {
    return schedulePigKilled(game, event, now);
  }

  if (event.type === "player_damaged") {
    const ai = ensureAIState(game);
    if (now - ai.lastPlayerDamagedAt < PLAYER_DAMAGED_COOLDOWN_SECONDS) {
      return null;
    }
    ai.lastPlayerDamagedAt = now;
    return createDecision("PLAYER_DAMAGED", "cabbage", 2, "hurt", {
      sourceType: event.type,
      intentHint: "warn",
      emotionHint: "hurt",
    });
  }

  if (event.type === "player_low_hp") {
    return createDecision("PLAYER_LOW_HP", "cabbage", 3, "nervous", {
      sourceType: event.type,
      intentHint: "warn",
      emotionHint: "scared",
      interrupt: true,
    });
  }

  if (event.type === "game_over") {
    return createDecision("GAME_OVER", "cabbage", 3, "sad", {
      sourceType: event.type,
      intentHint: "encourage",
      emotionHint: "sad",
      interrupt: true,
    });
  }

  if (event.type === "boss_intro") {
    return scheduleBossPhase(game, "BOSS_ENTER", "intro", "threatening", event.type, {
      delayMs: 0,
    });
  }

  if (event.type === "boss_half_hp") {
    return scheduleBossPhase(game, "BOSS_HALF_HP", "half", "angry", event.type);
  }

  if (event.type === "boss_charge_prepare" || event.type === "boss_stomp_prepare") {
    const phaseKey = event.type === "boss_stomp_prepare" ? "stomp" : "charge";
    return scheduleBossPhase(game, "BOSS_CHARGE", phaseKey, "threatening", event.type);
  }

  if (event.type === "boss_low_hp") {
    return scheduleBossPhase(game, "BOSS_LOW_HP", "low", "sad", event.type);
  }

  if (event.type === "boss_killed") {
    return scheduleBossPhase(game, "BOSS_DEATH", "death", "sad", event.type);
  }

  if (event.type === "wave_started" && event.payload?.wave === 1) {
    return createDecision(semanticEvent, "cabbage", 2, "nervous", {
      sourceType: event.type,
      intentHint: "encourage",
      emotionHint: "nervous",
    });
  }

  return null;
}

export function ensureAIState(game) {
  if (!game.dialogue) {
    game.dialogue = {};
  }
  if (!game.dialogue.ai) {
    game.dialogue.ai = {
      firstPigHitSpoken: false,
      recentHitTimes: [],
      pigBarkTimes: [],
      lastPigHitBarkAt: -Infinity,
      lastCabbageKillAt: -Infinity,
      lastPlayerDamagedAt: -Infinity,
      bossPhaseSpoken: {},
      bossBanterSpoken: {},
      recentEvents: [],
      recentDialogue: [],
      avoidTexts: [],
      chatHistory: [],
      dramaticMoments: [],
      playerProfile: {
        shots: 0,
        hits: 0,
        misses: 0,
        damageTakenCount: 0,
        lowHpWarnings: 0,
        recentHitCount: 0,
      },
    };
  }

  ensureAIMemoryShape(game.dialogue.ai);
  game.dialogue.recentHitTimes = game.dialogue.ai.recentHitTimes;
  game.dialogue.pigBarkTimes = game.dialogue.ai.pigBarkTimes;
  game.dialogue.recentEvents = game.dialogue.ai.recentEvents;
  game.dialogue.recentDialogue = game.dialogue.ai.recentDialogue;
  game.dialogue.avoidTexts = game.dialogue.ai.avoidTexts;
  game.dialogue.chatHistory = game.dialogue.ai.chatHistory;
  game.dialogue.dramaticMoments = game.dialogue.ai.dramaticMoments;
  return game.dialogue.ai;
}

export function recordDialogue(runtime, bark) {
  const ai = ensureAIState(runtime.game);
  ai.recentDialogue.push({
    speaker: bark.speaker,
    text: bark.text,
    time: runtime.game.time,
  });
  ai.recentDialogue = ai.recentDialogue.slice(-8);
  if (bark.text) {
    ai.avoidTexts.push(bark.text);
    ai.avoidTexts = uniqueRecent(ai.avoidTexts, AVOID_TEXT_LIMIT);
  }
  runtime.game.dialogue.recentDialogue = ai.recentDialogue;
  runtime.game.dialogue.avoidTexts = ai.avoidTexts;
}

function schedulePigHit(game, event, semanticEvent, now) {
  const ai = ensureAIState(game);
  ai.recentHitTimes = ai.recentHitTimes.filter((time) => now - time <= COMBO_WINDOW_SECONDS);
  ai.recentHitTimes.push(now);
  game.dialogue.recentHitTimes = ai.recentHitTimes;

  if (!ai.firstPigHitSpoken) {
    ai.firstPigHitSpoken = true;
    return createDecision("PLAYER_HIT_PIG", "cabbage", 2, "excited", {
      sourceType: event.type,
      intentHint: "encourage",
      emotionHint: "excited",
    });
  }

  if (ai.recentHitTimes.length >= COMBO_HIT_COUNT) {
    ai.recentHitTimes = [];
    game.dialogue.recentHitTimes = ai.recentHitTimes;
    recordDramaticMoment(game, "combo");
    return createDecision("PLAYER_COMBO", "cabbage", 2, "excited", {
      sourceType: event.type,
      intentHint: "celebrate",
      emotionHint: "excited",
    });
  }

  if (now - ai.lastPigHitBarkAt < PIG_HIT_COOLDOWN_SECONDS || !allowPigBark(game, now)) {
    return null;
  }
  ai.lastPigHitBarkAt = now;
  return createDecision(semanticEvent, "pig", 1, "hurt", {
    sourceType: event.type,
    intentHint: "taunt",
    emotionHint: "hurt",
    canBeDropped: true,
  });
}

function schedulePigKilled(game, event, now) {
  const ai = ensureAIState(game);
  const canCabbageReact = now - ai.lastCabbageKillAt >= CABBAGE_KILL_COOLDOWN_SECONDS;
  const canPigReact = allowPigBark(game, now);

  if (canPigReact) {
    const decision = createDecision("PIG_DEATH", "pig", 1, "sad", {
      sourceType: event.type,
      intentHint: "taunt",
      emotionHint: "sad",
      canBeDropped: true,
    });

    if (canCabbageReact) {
      ai.lastCabbageKillAt = now;
      decision.followUps = [
        createDecision("PIG_DEATH", "cabbage", 2, "excited", {
          sourceType: event.type,
          intentHint: "celebrate",
          emotionHint: "excited",
          delayMs: 650,
        }),
      ];
    }
    return decision;
  }

  if (!canCabbageReact) {
    return null;
  }
  ai.lastCabbageKillAt = now;
  return createDecision("PIG_DEATH", "cabbage", 2, "excited", {
    sourceType: event.type,
    intentHint: "celebrate",
    emotionHint: "excited",
  });
}

function scheduleBossPhase(game, eventType, phaseKey, toneHint, sourceType, extras = {}) {
  const ai = ensureAIState(game);
  const wave = game.wave ?? "unknown";
  const key = `${wave}:${phaseKey}`;
  if (ai.bossPhaseSpoken[key]) {
    return null;
  }
  ai.bossPhaseSpoken[key] = true;
  recordDramaticMoment(game, sourceType);

  const decision = createDecision(eventType, "pigKing", 3, toneHint, {
    sourceType,
    intentHint: toneHint === "sad" ? "taunt" : "taunt",
    emotionHint: toneHint === "sad" ? "sad" : "angry",
    interrupt: true,
    ...extras,
  });
  decision.followUps = [
    createDecision(eventType, "cabbage", 3, toneForCabbageBossPhase(phaseKey), {
      sourceType,
      intentHint: "banter_reply",
      emotionHint: emotionForCabbageBossPhase(phaseKey),
      delayMs: followUpDelayForBossPhase(phaseKey),
      interrupt: true,
    }),
  ];
  return decision;
}

function allowPigBark(game, now) {
  const ai = ensureAIState(game);
  ai.pigBarkTimes = ai.pigBarkTimes.filter((time) => now - time <= PIG_BARK_WINDOW_SECONDS);
  if (ai.pigBarkTimes.length >= PIG_BARK_LIMIT) {
    game.dialogue.pigBarkTimes = ai.pigBarkTimes;
    return false;
  }
  ai.pigBarkTimes.push(now);
  game.dialogue.pigBarkTimes = ai.pigBarkTimes;
  return true;
}

function recordRecentEvent(game, event) {
  const ai = ensureAIState(game);
  updatePlayerProfile(game, event);
  ai.recentEvents.push({
    type: event.type,
    time: game.time,
    pigId: event.payload?.pigId ?? null,
  });
  ai.recentEvents = ai.recentEvents.slice(-8);
  game.dialogue.recentEvents = ai.recentEvents;
}

function createDecision(eventType, speakerType, priority, toneHint, options = {}) {
  return {
    shouldRequestAI: true,
    eventType,
    sourceType: options.sourceType ?? eventType,
    speakerType,
    priority,
    shouldVoice: false,
    toneHint,
    intentHint: options.intentHint ?? intentForEvent(eventType, speakerType),
    emotionHint: options.emotionHint ?? emotionForTone(toneHint),
    interrupt: Boolean(options.interrupt),
    canBeDropped: Boolean(options.canBeDropped),
    delayMs: options.delayMs ?? 0,
  };
}

function ensureAIMemoryShape(ai) {
  ai.bossBanterSpoken ??= {};
  ai.avoidTexts ??= [];
  ai.chatHistory ??= [];
  ai.dramaticMoments ??= [];
  ai.playerProfile ??= {};
  ai.playerProfile.shots ??= 0;
  ai.playerProfile.hits ??= 0;
  ai.playerProfile.misses ??= 0;
  ai.playerProfile.damageTakenCount ??= 0;
  ai.playerProfile.lowHpWarnings ??= 0;
  ai.playerProfile.recentHitCount ??= 0;
}

function updatePlayerProfile(game, event) {
  const ai = ensureAIState(game);
  const profile = ai.playerProfile;
  profile.shots = Number.isFinite(game.shots) ? game.shots : profile.shots;
  if (event.type === "pig_hit") {
    profile.hits += 1;
  }
  if (event.type === "player_damaged") {
    profile.damageTakenCount += 1;
  }
  if (event.type === "player_low_hp") {
    profile.lowHpWarnings += 1;
    recordDramaticMoment(game, "player_low_hp");
  }
  profile.recentHitCount = Array.isArray(ai.recentHitTimes) ? ai.recentHitTimes.length : 0;
  profile.misses = Math.max(0, profile.shots - profile.hits);
}

function recordDramaticMoment(game, type) {
  const ai = ensureAIState(game);
  ai.dramaticMoments.push({
    type,
    time: Number.isFinite(game.time) ? game.time : 0,
    wave: game.wave ?? null,
  });
  ai.dramaticMoments = ai.dramaticMoments.slice(-DRAMATIC_MOMENT_LIMIT);
  game.dialogue.dramaticMoments = ai.dramaticMoments;
}

function intentForEvent(eventType, speakerType) {
  if (eventType === "PLAYER_LOW_HP" || eventType === "PLAYER_DAMAGED") {
    return "warn";
  }
  if (eventType === "PLAYER_COMBO" || eventType === "PIG_DEATH") {
    return speakerType === "pig" ? "taunt" : "celebrate";
  }
  if (speakerType === "pig" || speakerType === "pigKing") {
    return "taunt";
  }
  return "encourage";
}

function emotionForTone(tone) {
  if (tone === "excited") {
    return "excited";
  }
  if (tone === "hurt") {
    return "hurt";
  }
  if (tone === "angry") {
    return "angry";
  }
  if (tone === "sad") {
    return "sad";
  }
  if (tone === "absurd") {
    return "teasing";
  }
  if (tone === "threatening") {
    return "angry";
  }
  return "nervous";
}

function toneForCabbageBossPhase(phaseKey) {
  if (phaseKey === "death") {
    return "excited";
  }
  if (phaseKey === "low") {
    return "nervous";
  }
  return "nervous";
}

function emotionForCabbageBossPhase(phaseKey) {
  if (phaseKey === "intro") {
    return "scared";
  }
  if (phaseKey === "death") {
    return "excited";
  }
  return "nervous";
}

function followUpDelayForBossPhase(phaseKey) {
  if (phaseKey === "intro") {
    return 950;
  }
  if (phaseKey === "death") {
    return 1200;
  }
  return 850;
}

function uniqueRecent(items, limit) {
  const result = [];
  for (let i = items.length - 1; i >= 0 && result.length < limit; i -= 1) {
    const item = items[i];
    if (item && !result.includes(item)) {
      result.unshift(item);
    }
  }
  return result;
}
