import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { encodeTTSRequest, parseTTSResponse, TTS_EVENTS } from "./doubaoTtsProtocol.js";
import { NativeWebSocket } from "./nativeWebSocket.js";

const DEFAULT_WS_URL = "wss://openspeech.bytedance.com/api/v3/tts/bidirection";
const DEFAULT_RESOURCE_ID = "seed-icl-2.0";
const DEFAULT_MODEL = "seed-tts-2.0-standard";
const DEFAULT_FORMAT = "mp3";
const DEFAULT_SAMPLE_RATE = 24000;
const DEFAULT_BIT_RATE = 64000;
const DEFAULT_TIMEOUT_MS = 7000;
const PLACEHOLDER_VALUES = new Set([
  "",
  "PASTE_YOUR_TTS_KEY_HERE",
  "your_doubao_tts_api_key_here",
  "PASTE_CABBAGE_VOICE_ID_HERE",
  "PASTE_PIG_VOICE_ID_HERE",
  "PASTE_PIGKING_VOICE_ID_HERE",
]);

const VOICE_ENV_KEYS = {
  cabbage: "DOUBAO_TTS_VOICE_CABBAGE",
  cabbageSpirit: "DOUBAO_TTS_VOICE_CABBAGE",
  pig: "DOUBAO_TTS_VOICE_PIG",
  pigKing: "DOUBAO_TTS_VOICE_PIGKING",
};

const MIME_TYPES = {
  mp3: "audio/mpeg",
  ogg_opus: "audio/ogg; codecs=opus",
  pcm: "audio/L16",
};

export async function synthesizeDoubaoTTS(request) {
  const config = buildDoubaoTTSConfig(request);
  if (!config.enabled) {
    return {
      ok: true,
      skipped: true,
      reason: config.reason,
    };
  }

  const audio = await runTTSWebSocket(config, request);
  return {
    ok: true,
    skipped: false,
    source: "doubao",
    audio: {
      base64: audio.toString("base64"),
      mimeType: MIME_TYPES[config.format] ?? MIME_TYPES.mp3,
      format: config.format,
      sampleRate: config.sampleRate,
    },
  };
}

export function buildDoubaoTTSConfig(request) {
  const env = getServerEnv();
  const enabled = parseBoolean(env.DOUBAO_TTS_ENABLED, true);
  if (!enabled) {
    return { enabled: false, reason: "tts_disabled" };
  }

  const apiKey = env.DOUBAO_TTS_API_KEY ?? "";
  if (isPlaceholder(apiKey)) {
    return { enabled: false, reason: "tts_api_key_missing" };
  }

  const voiceId = pickVoiceId(env, request.speaker);
  if (isPlaceholder(voiceId)) {
    return { enabled: false, reason: "tts_voice_missing" };
  }

  return {
    enabled: true,
    apiKey,
    wsUrl: env.DOUBAO_TTS_WS_URL || DEFAULT_WS_URL,
    resourceId: env.DOUBAO_TTS_RESOURCE_ID || DEFAULT_RESOURCE_ID,
    model: env.DOUBAO_TTS_MODEL || DEFAULT_MODEL,
    voiceId,
    format: env.DOUBAO_TTS_AUDIO_FORMAT || DEFAULT_FORMAT,
    sampleRate: parsePositiveInt(env.DOUBAO_TTS_SAMPLE_RATE) ?? DEFAULT_SAMPLE_RATE,
    bitRate: parsePositiveInt(env.DOUBAO_TTS_BIT_RATE) ?? DEFAULT_BIT_RATE,
    timeoutMs: parsePositiveInt(env.DOUBAO_TTS_TIMEOUT_MS) ?? DEFAULT_TIMEOUT_MS,
  };
}

async function runTTSWebSocket(config, request) {
  const sessionId = randomUUID();
  const connectId = randomUUID();
  const audioChunks = [];

  return await new Promise((resolvePromise, rejectPromise) => {
    let settled = false;
    const ws = new NativeWebSocket(config.wsUrl, {
      headers: {
        "X-Api-Key": config.apiKey,
        "X-Api-Resource-Id": config.resourceId,
        "X-Api-Connect-Id": connectId,
      },
    });

    const timer = setTimeout(() => {
      fail(new Error("Doubao TTS request timed out"));
    }, config.timeoutMs);

    ws.on("open", () => {
      ws.send(encodeTTSRequest(TTS_EVENTS.START_CONNECTION, {}));
    });

    ws.on("message", (data) => {
      try {
        const packet = parseTTSResponse(data);
        handlePacket(packet);
      } catch (error) {
        fail(error);
      }
    });

    ws.on("error", (error) => {
      fail(error);
    });

    ws.on("close", () => {
      if (!settled) {
        fail(new Error("Doubao TTS connection closed before completion"));
      }
    });

    function handlePacket(packet) {
      if (packet.kind === "error") {
        fail(new Error(packet.json?.message || `Doubao TTS error ${packet.errorCode}`));
        return;
      }

      if (packet.event === TTS_EVENTS.CONNECTION_STARTED) {
        ws.send(encodeTTSRequest(TTS_EVENTS.START_SESSION, buildSessionPayload(config, request), { sessionId }));
        return;
      }

      if (packet.event === TTS_EVENTS.CONNECTION_FAILED) {
        fail(new Error(packet.json?.message || "Doubao TTS connection failed"));
        return;
      }

      if (packet.event === TTS_EVENTS.SESSION_STARTED) {
        ws.send(encodeTTSRequest(TTS_EVENTS.TASK_REQUEST, buildTaskPayload(request), { sessionId }));
        ws.send(encodeTTSRequest(TTS_EVENTS.FINISH_SESSION, {}, { sessionId }));
        return;
      }

      if (packet.event === TTS_EVENTS.SESSION_FAILED || packet.event === TTS_EVENTS.SESSION_CANCELED) {
        fail(new Error(packet.json?.message || "Doubao TTS session failed"));
        return;
      }

      if ((packet.kind === "audio" || packet.event === TTS_EVENTS.TTS_RESPONSE) && packet.payload?.length) {
        audioChunks.push(packet.payload);
        return;
      }

      if (packet.event === TTS_EVENTS.SESSION_FINISHED) {
        if (!audioChunks.length) {
          fail(new Error("Doubao TTS returned no audio"));
          return;
        }
        finish(Buffer.concat(audioChunks));
      }
    }

    function finish(audioBuffer) {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      try {
        ws.send(encodeTTSRequest(TTS_EVENTS.FINISH_CONNECTION, {}));
      } catch {}
      ws.close();
      resolvePromise(audioBuffer);
    }

    function fail(error) {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      try {
        ws.close();
      } catch {}
      rejectPromise(error);
    }
  });
}

function buildSessionPayload(config, request) {
  return {
    event: TTS_EVENTS.START_SESSION,
    user: {
      uid: "cabbage-defense",
    },
    namespace: "BidirectionalTTS",
    req_params: {
      speaker: config.voiceId,
      model: config.model,
      text: "",
      additions: JSON.stringify({
        disable_markdown_filter: true,
        disable_emoji_filter: false,
        enable_language_detector: false,
      }),
      audio_params: {
        format: config.format,
        sample_rate: config.sampleRate,
        bit_rate: config.bitRate,
        speech_rate: speechRateFor(request),
        loudness_rate: loudnessFor(request),
        enable_subtitle: false,
      },
    },
  };
}

function buildTaskPayload(request) {
  return {
    event: TTS_EVENTS.TASK_REQUEST,
    namespace: "BidirectionalTTS",
    user: {
      uid: "cabbage-defense",
    },
    req_params: {
      text: request.text,
    },
  };
}

function speechRateFor(request) {
  if (request.speaker === "pig" || request.speaker === "pigKing") {
    return request.tone === "sad" ? -8 : 8;
  }
  if (request.tone === "excited") {
    return 8;
  }
  if (request.tone === "sad" || request.tone === "hurt") {
    return -6;
  }
  return 0;
}

function loudnessFor(request) {
  if (request.speaker === "pigKing") {
    return 10;
  }
  if (request.tone === "nervous") {
    return -4;
  }
  return 0;
}

function pickVoiceId(env, speaker) {
  const key = VOICE_ENV_KEYS[speaker] ?? "";
  if (key && !isPlaceholder(env[key])) {
    return env[key];
  }
  if (speaker === "pig" && !isPlaceholder(env.DOUBAO_TTS_VOICE_PIGKING)) {
    return env.DOUBAO_TTS_VOICE_PIGKING;
  }
  if (speaker === "pigKing" && !isPlaceholder(env.DOUBAO_TTS_VOICE_PIG)) {
    return env.DOUBAO_TTS_VOICE_PIG;
  }
  if ((speaker === "pig" || speaker === "pigKing") && !isPlaceholder(env.DOUBAO_TTS_VOICE_CABBAGE)) {
    return env.DOUBAO_TTS_VOICE_CABBAGE;
  }
  return "";
}

function getServerEnv() {
  return {
    ...loadLocalEnv(),
    ...(typeof process !== "undefined" && process.env ? process.env : {}),
  };
}

function loadLocalEnv() {
  try {
    const raw = readFileSync(resolve(process.cwd(), ".env"), "utf8");
    return Object.fromEntries(
      raw
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith("#") && line.includes("="))
        .map((line) => {
          const index = line.indexOf("=");
          return [line.slice(0, index).trim(), line.slice(index + 1).trim()];
        })
    );
  } catch {
    return {};
  }
}

function isPlaceholder(value) {
  return PLACEHOLDER_VALUES.has(String(value ?? "").trim());
}

function parseBoolean(value, defaultValue) {
  if (value === undefined || value === null || value === "") {
    return defaultValue;
  }
  return !["0", "false", "off", "no"].includes(String(value).trim().toLowerCase());
}

function parsePositiveInt(value) {
  const number = Number.parseInt(value, 10);
  return Number.isFinite(number) && number > 0 ? number : null;
}
