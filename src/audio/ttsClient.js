export const USE_REMOTE_TTS = true;

const TTS_ENDPOINT = "/api/tts";
const TTS_TIMEOUT_MS = 9000;
const SPEAKER_COOLDOWNS = {
  cabbage: 4.2,
  cabbageSpirit: 4.2,
  pig: 10,
  pigKing: 2.2,
};
const ATTEMPT_COOLDOWNS = {
  cabbage: 1.4,
  pig: 2.6,
  pigKing: 1.2,
};
const VOICE_BUDGETS = {
  normal: {
    cabbage: 5,
    pig: 1,
    pigKing: 0,
  },
  boss: {
    cabbage: 5,
    pig: 1,
    pigKing: 3,
  },
};
const VOICE_RANKS = {
  cabbage: 2,
  pig: 2,
  pigKing: 3,
};
const BOSS_PRIMARY_SLOTS = new Set(["boss_intro", "boss_half_hp", "boss_killed"]);
const BOSS_FILLER_SLOT = "boss_low_hp";
const BOSS_QUIET_SLOTS = new Set(["boss_charge_prepare", "boss_stomp_prepare"]);
const SOURCE_TO_SLOT = {
  boss_intro: "boss_intro",
  boss_half_hp: "boss_half_hp",
  boss_low_hp: "boss_low_hp",
  boss_killed: "boss_killed",
  boss_charge_prepare: "boss_charge_prepare",
  boss_stomp_prepare: "boss_stomp_prepare",
  player_chat: "player_chat",
};
const EVENT_TO_SLOT = {
  BOSS_ENTER: "boss_intro",
  BOSS_HALF_HP: "boss_half_hp",
  BOSS_LOW_HP: "boss_low_hp",
  BOSS_DEATH: "boss_killed",
  BOSS_CHARGE: "boss_charge_prepare",
  PLAYER_CHAT: "player_chat",
};

export function createTTSState() {
  return {
    inFlight: false,
    inFlightSpeaker: "",
    inFlightSlot: "",
    inFlightRank: 0,
    currentAudio: null,
    currentObjectUrl: "",
    currentSpeaker: "",
    currentSlot: "",
    currentRank: 0,
    lastAttemptAt: {},
    lastSpokenAt: {},
    requestId: 0,
    voiceMix: createVoiceMix(null, "normal"),
  };
}

export function resetTTSState(runtime) {
  if (runtime.tts?.currentAudio) {
    runtime.tts.currentAudio.pause();
    cleanupObjectUrl(runtime.tts);
  }
  runtime.tts = createTTSState();
}

export function maybeSpeakBark(runtime, bark) {
  if (!USE_REMOTE_TTS || !bark?.text || !bark.voiceEnabled) {
    return;
  }

  const state = ensureTTSState(runtime);
  syncVoiceMixState(state, runtime.game);

  const now = runtime.game?.time ?? performance.now() / 1000;
  const context = createVoiceContext(bark, now);
  markVoiceCandidateSeen(state, context);
  if (!canUseVoiceBudget(state, context)) {
    return;
  }
  if (!passesVoiceCooldown(state, context)) {
    return;
  }
  if (!canRequestVoice(state, context)) {
    return;
  }

  state.lastAttemptAt[attemptKey(context)] = now;
  state.inFlight = true;
  state.inFlightSpeaker = context.speaker;
  state.inFlightSlot = context.voiceSlot;
  state.inFlightRank = context.rank;
  const requestId = ++state.requestId;

  requestTTS({
    speaker: context.speaker,
    text: bark.text,
    tone: bark.tone,
    priority: context.rank,
    voiceStyle: bark.voiceStyle,
    eventType: bark.eventType,
    sourceType: bark.sourceType,
    voiceSlot: context.voiceSlot,
  })
    .then((response) => {
      if (requestId !== state.requestId || !response?.audio?.base64) {
        return;
      }
      playAudioResponse(state, response.audio, context);
    })
    .catch(() => {})
    .finally(() => {
      if (requestId === state.requestId) {
        clearInFlight(state);
      }
    });
}

async function requestTTS(payload) {
  const response = await requestWithTimeout(TTS_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    return null;
  }

  const body = await response.json();
  if (!body?.ok || body.skipped) {
    if (body?.reason) {
      console.warn(`[tts] skipped ${payload.speaker}: ${body.reason}`);
    }
    return null;
  }
  return body;
}

function createVoiceContext(bark, now) {
  const speaker = normalizeSpeaker(bark.speaker);
  const voiceSlot = getVoiceSlot(bark, speaker);
  return {
    bark,
    speaker,
    voiceSlot,
    rank: VOICE_RANKS[speaker] ?? bark.voicePriority ?? bark.priority ?? 1,
    forceVoice: Boolean(bark.forceVoice),
    now,
  };
}

function canUseVoiceBudget(state, context) {
  if (isExtraCabbageChat(context)) {
    return true;
  }

  const budget = currentBudget(state)[context.speaker] ?? 0;
  const spoken = state.voiceMix.spoken[context.speaker] ?? 0;
  if (spoken >= budget) {
    return false;
  }

  if (context.speaker !== "pigKing") {
    return true;
  }
  if (state.voiceMix.encounterType !== "boss" || BOSS_QUIET_SLOTS.has(context.voiceSlot)) {
    return false;
  }
  if (BOSS_PRIMARY_SLOTS.has(context.voiceSlot)) {
    return !state.voiceMix.bossPrimarySpoken[context.voiceSlot];
  }
  if (context.voiceSlot === BOSS_FILLER_SLOT) {
    return hasBossVoiceDeficit(state);
  }
  return true;
}

function passesVoiceCooldown(state, context) {
  const attemptCooldown = ATTEMPT_COOLDOWNS[context.speaker] ?? 1.5;
  if (context.now - (state.lastAttemptAt[attemptKey(context)] ?? -Infinity) < attemptCooldown) {
    return false;
  }

  if (isExtraCabbageChat(context)) {
    return true;
  }

  const cooldown = SPEAKER_COOLDOWNS[context.bark.speaker] ?? SPEAKER_COOLDOWNS[context.speaker] ?? 4;
  return context.now - (state.lastSpokenAt[context.speaker] ?? -Infinity) >= cooldown;
}

function canRequestVoice(state, context) {
  if (state.inFlight) {
    return canBossKeyPreemptCabbage(context, state.inFlightSpeaker);
  }

  if (!isAudioActive(state)) {
    return true;
  }

  return canBossKeyPreemptCabbage(context, state.currentSpeaker);
}

function playAudioResponse(state, audio, context) {
  const bytes = base64ToBytes(audio.base64);
  if (!bytes.length) {
    return false;
  }

  if (isAudioActive(state) && !canBossKeyPreemptCabbage(context, state.currentSpeaker)) {
    return false;
  }

  if (state.currentAudio) {
    state.currentAudio.pause();
    cleanupObjectUrl(state);
  }

  const blob = new Blob([bytes], { type: audio.mimeType || "audio/mpeg" });
  const objectUrl = URL.createObjectURL(blob);
  const element = new Audio(objectUrl);
  element.volume = 0.82;
  element.onended = () => cleanupObjectUrl(state);
  element.onerror = () => cleanupObjectUrl(state);

  state.currentAudio = element;
  state.currentObjectUrl = objectUrl;
  state.currentSpeaker = context.speaker;
  state.currentSlot = context.voiceSlot;
  state.currentRank = context.rank;

  const playResult = element.play();
  if (playResult?.then) {
    playResult.then(() => markVoiceSpoken(state, context)).catch(() => cleanupObjectUrl(state));
  } else {
    markVoiceSpoken(state, context);
  }
  return true;
}

function markVoiceCandidateSeen(state, context) {
  if (context.speaker === "pigKing" && BOSS_PRIMARY_SLOTS.has(context.voiceSlot)) {
    state.voiceMix.bossPrimarySeen[context.voiceSlot] = true;
  }
}

function markVoiceSpoken(state, context) {
  state.lastSpokenAt[context.speaker] = context.now;
  if (countsAgainstBudget(context)) {
    state.voiceMix.spoken[context.speaker] = (state.voiceMix.spoken[context.speaker] ?? 0) + 1;
  }
  if (context.speaker === "pigKing" && BOSS_PRIMARY_SLOTS.has(context.voiceSlot)) {
    state.voiceMix.bossPrimarySpoken[context.voiceSlot] = true;
  }
}

function countsAgainstBudget(context) {
  return !isExtraCabbageChat(context);
}

function isExtraCabbageChat(context) {
  return context.speaker === "cabbage" && context.voiceSlot === "player_chat" && context.forceVoice;
}

function hasBossVoiceDeficit(state) {
  return countTrue(state.voiceMix.bossPrimarySeen) > countTrue(state.voiceMix.bossPrimarySpoken);
}

function canBossKeyPreemptCabbage(context, currentSpeaker) {
  return context.speaker === "pigKing" && isBossKeySlot(context.voiceSlot) && currentSpeaker === "cabbage";
}

function isBossKeySlot(voiceSlot) {
  return BOSS_PRIMARY_SLOTS.has(voiceSlot) || voiceSlot === BOSS_FILLER_SLOT;
}

function getVoiceSlot(bark, speaker) {
  if (typeof bark.voiceSlot === "string" && bark.voiceSlot) {
    return bark.voiceSlot;
  }

  const sourceSlot = SOURCE_TO_SLOT[String(bark.sourceType ?? "").trim().toLowerCase()];
  if (sourceSlot) {
    return sourceSlot;
  }

  const eventSlot = EVENT_TO_SLOT[String(bark.eventType ?? "").trim().toUpperCase()];
  if (eventSlot) {
    return eventSlot;
  }

  return `${speaker}_event`;
}

function syncVoiceMixState(state, game) {
  const wave = Number.isFinite(game?.wave) ? game.wave : null;
  const encounterType = game?.encounterType === "boss" ? "boss" : "normal";
  if (!state.voiceMix || state.voiceMix.wave !== wave || state.voiceMix.encounterType !== encounterType) {
    state.voiceMix = createVoiceMix(wave, encounterType);
  }
}

function createVoiceMix(wave, encounterType) {
  return {
    wave,
    encounterType,
    spoken: {
      cabbage: 0,
      pig: 0,
      pigKing: 0,
    },
    bossPrimarySeen: {},
    bossPrimarySpoken: {},
  };
}

function currentBudget(state) {
  return VOICE_BUDGETS[state.voiceMix?.encounterType] ?? VOICE_BUDGETS.normal;
}

function isAudioActive(state) {
  return Boolean(state.currentAudio && !state.currentAudio.ended && !state.currentAudio.paused);
}

function attemptKey(context) {
  return `${context.speaker}:${context.voiceSlot}`;
}

function clearInFlight(state) {
  state.inFlight = false;
  state.inFlightSpeaker = "";
  state.inFlightSlot = "";
  state.inFlightRank = 0;
}

async function requestWithTimeout(url, options) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TTS_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function ensureTTSState(runtime) {
  if (!runtime.tts) {
    runtime.tts = createTTSState();
  }
  return runtime.tts;
}

function normalizeSpeaker(speaker) {
  return speaker === "cabbageSpirit" ? "cabbage" : speaker;
}

function countTrue(record) {
  return Object.values(record).filter(Boolean).length;
}

function base64ToBytes(base64) {
  try {
    const raw = atob(base64);
    const bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i += 1) {
      bytes[i] = raw.charCodeAt(i);
    }
    return bytes;
  } catch {
    return new Uint8Array();
  }
}

function cleanupObjectUrl(state) {
  if (state.currentObjectUrl) {
    URL.revokeObjectURL(state.currentObjectUrl);
  }
  state.currentObjectUrl = "";
  state.currentAudio = null;
  state.currentSpeaker = "";
  state.currentSlot = "";
  state.currentRank = 0;
}
