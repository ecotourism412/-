export const USE_REMOTE_TTS = true;

const TTS_ENDPOINT = "/api/tts";
const TTS_TIMEOUT_MS = 9000;
const SPEAKER_COOLDOWNS = {
  cabbage: 6.5,
  cabbageSpirit: 6.5,
  pig: 6.5,
  pigKing: 1.5,
};

export function createTTSState() {
  return {
    inFlight: false,
    currentAudio: null,
    currentObjectUrl: "",
    currentPriority: 0,
    inFlightPriority: 0,
    lastSpokenAt: {},
    requestId: 0,
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
  const now = runtime.game?.time ?? performance.now() / 1000;
  const speaker = normalizeSpeaker(bark.speaker);
  const cooldown = SPEAKER_COOLDOWNS[bark.speaker] ?? SPEAKER_COOLDOWNS[speaker] ?? 4;
  if (!bark.forceVoice && now - (state.lastSpokenAt[speaker] ?? -Infinity) < cooldown) {
    return;
  }

  const voicePriority = bark.voicePriority ?? bark.priority ?? 1;
  if (!canRequestVoice(state, voicePriority, bark.forceVoice)) {
    return;
  }

  state.lastSpokenAt[speaker] = now;
  state.inFlight = true;
  state.inFlightPriority = voicePriority;
  const requestId = ++state.requestId;

  requestTTS({
    speaker,
    text: bark.text,
    tone: bark.tone,
    priority: voicePriority,
    voiceStyle: bark.voiceStyle,
  })
    .then((response) => {
      if (requestId !== state.requestId || !response?.audio?.base64) {
        return;
      }
      playAudioResponse(state, response.audio, voicePriority);
    })
    .catch(() => {})
    .finally(() => {
      if (requestId === state.requestId) {
        state.inFlight = false;
        state.inFlightPriority = 0;
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

function canRequestVoice(state, voicePriority, forceVoice) {
  if (state.inFlight && voicePriority <= state.inFlightPriority) {
    return false;
  }

  if (!state.currentAudio || state.currentAudio.ended || state.currentAudio.paused) {
    return true;
  }

  if (voicePriority > state.currentPriority) {
    return true;
  }

  return Boolean(forceVoice && voicePriority >= state.currentPriority);
}

function playAudioResponse(state, audio, priority) {
  const bytes = base64ToBytes(audio.base64);
  if (!bytes.length) {
    return;
  }

  if (state.currentAudio && !state.currentAudio.ended && !state.currentAudio.paused && priority <= state.currentPriority) {
    return;
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
  state.currentPriority = priority;
  element.play().catch(() => cleanupObjectUrl(state));
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
  state.currentPriority = 0;
}
