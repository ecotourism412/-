export const TTS_EVENTS = {
  START_CONNECTION: 1,
  FINISH_CONNECTION: 2,
  CONNECTION_STARTED: 50,
  CONNECTION_FAILED: 51,
  CONNECTION_FINISHED: 52,
  START_SESSION: 100,
  CANCEL_SESSION: 101,
  FINISH_SESSION: 102,
  SESSION_STARTED: 150,
  SESSION_CANCELED: 151,
  SESSION_FINISHED: 152,
  SESSION_FAILED: 153,
  TASK_REQUEST: 200,
  TTS_SENTENCE_START: 350,
  TTS_SENTENCE_END: 351,
  TTS_RESPONSE: 352,
};

const MESSAGE_TYPE_FULL_CLIENT_REQUEST = 0x1;
const MESSAGE_TYPE_FULL_SERVER_RESPONSE = 0x9;
const MESSAGE_TYPE_AUDIO_ONLY_RESPONSE = 0xb;
const MESSAGE_TYPE_ERROR = 0xf;
const FLAG_WITH_EVENT = 0x4;
const SERIALIZATION_RAW = 0x0;
const SERIALIZATION_JSON = 0x1;
const COMPRESSION_NONE = 0x0;

export function encodeTTSRequest(eventCode, payload = {}, options = {}) {
  const payloadBuffer = Buffer.from(JSON.stringify(payload ?? {}), "utf8");
  const header = Buffer.from([
    0x11,
    (MESSAGE_TYPE_FULL_CLIENT_REQUEST << 4) | FLAG_WITH_EVENT,
    (SERIALIZATION_JSON << 4) | COMPRESSION_NONE,
    0x00,
  ]);
  const eventBuffer = Buffer.alloc(4);
  eventBuffer.writeInt32BE(eventCode, 0);

  const chunks = [header, eventBuffer];
  if (options.sessionId) {
    chunks.push(encodeSizedString(options.sessionId));
  }
  chunks.push(encodeSizedBuffer(payloadBuffer));
  return Buffer.concat(chunks);
}

export function parseTTSResponse(data) {
  const buffer = Array.isArray(data) ? Buffer.concat(data) : Buffer.isBuffer(data) ? data : Buffer.from(data);
  if (buffer.length < 4) {
    throw new Error("TTS packet is too short");
  }

  const headerSize = (buffer[0] & 0x0f) * 4;
  const messageType = buffer[1] >> 4;
  const flags = buffer[1] & 0x0f;
  const serialization = buffer[2] >> 4;
  const compression = buffer[2] & 0x0f;
  let offset = headerSize;

  if (compression !== COMPRESSION_NONE) {
    throw new Error("Compressed TTS packets are not supported yet");
  }

  if (messageType === MESSAGE_TYPE_ERROR) {
    const errorCode = readInt32(buffer, offset);
    offset += 4;
    return {
      kind: "error",
      event: null,
      errorCode,
      payload: buffer.slice(offset),
      json: parseJson(buffer.slice(offset)),
    };
  }

  let event = null;
  if ((flags & FLAG_WITH_EVENT) === FLAG_WITH_EVENT) {
    event = readInt32(buffer, offset);
    offset += 4;
  }

  if (isConnectionEvent(event)) {
    const parsed = parseConnectionPayload(buffer, offset, serialization);
    return {
      kind: "connection",
      messageType,
      event,
      ...parsed,
    };
  }

  if (messageType === MESSAGE_TYPE_FULL_SERVER_RESPONSE || messageType === MESSAGE_TYPE_AUDIO_ONLY_RESPONSE) {
    const parsed = parseSessionPayload(buffer, offset, serialization);
    if (messageType === MESSAGE_TYPE_AUDIO_ONLY_RESPONSE || event === TTS_EVENTS.TTS_RESPONSE) {
      return {
        kind: "audio",
        messageType,
        event,
        ...parsed,
        json: null,
      };
    }
    return {
      kind: "session",
      messageType,
      event,
      ...parsed,
    };
  }

  return {
    kind: "unknown",
    messageType,
    event,
    payload: buffer.slice(offset),
    json: serialization === SERIALIZATION_JSON ? parseJson(buffer.slice(offset)) : null,
  };
}

function parseConnectionPayload(buffer, offset, serialization) {
  const first = tryReadSizedBuffer(buffer, offset);
  if (!first) {
    return { connectionId: "", payload: Buffer.alloc(0), json: null };
  }

  const second = tryReadSizedBuffer(buffer, first.nextOffset);
  if (second) {
    return {
      connectionId: first.value.toString("utf8"),
      payload: second.value,
      json: serialization === SERIALIZATION_JSON ? parseJson(second.value) : null,
    };
  }

  return {
    connectionId: "",
    payload: first.value,
    json: serialization === SERIALIZATION_JSON ? parseJson(first.value) : null,
  };
}

function parseSessionPayload(buffer, offset, serialization) {
  const session = tryReadSizedBuffer(buffer, offset);
  if (!session) {
    return {
      sessionId: "",
      payload: Buffer.alloc(0),
      json: null,
    };
  }

  const payload = tryReadSizedBuffer(buffer, session.nextOffset);
  const payloadBuffer = payload?.value ?? Buffer.alloc(0);
  return {
    sessionId: session.value.toString("utf8"),
    payload: payloadBuffer,
    json: serialization === SERIALIZATION_JSON ? parseJson(payloadBuffer) : null,
  };
}

function encodeSizedString(value) {
  return encodeSizedBuffer(Buffer.from(value, "utf8"));
}

function encodeSizedBuffer(value) {
  const size = Buffer.alloc(4);
  size.writeUInt32BE(value.length, 0);
  return Buffer.concat([size, value]);
}

function tryReadSizedBuffer(buffer, offset) {
  if (offset + 4 > buffer.length) {
    return null;
  }
  const size = buffer.readUInt32BE(offset);
  const start = offset + 4;
  const end = start + size;
  if (size < 0 || end > buffer.length) {
    return null;
  }
  return {
    value: buffer.slice(start, end),
    nextOffset: end,
  };
}

function readInt32(buffer, offset) {
  if (offset + 4 > buffer.length) {
    throw new Error("TTS packet int32 is truncated");
  }
  return buffer.readInt32BE(offset);
}

function parseJson(buffer) {
  if (!buffer?.length) {
    return null;
  }
  const text = buffer.toString("utf8").trim();
  if (!text) {
    return null;
  }
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function isConnectionEvent(event) {
  return (
    event === TTS_EVENTS.CONNECTION_STARTED ||
    event === TTS_EVENTS.CONNECTION_FAILED ||
    event === TTS_EVENTS.CONNECTION_FINISHED
  );
}
