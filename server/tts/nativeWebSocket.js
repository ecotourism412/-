import { EventEmitter } from "node:events";
import { randomBytes, createHash } from "node:crypto";
import { connect as tlsConnect } from "node:tls";
import { connect as netConnect } from "node:net";

const GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";

export class NativeWebSocket extends EventEmitter {
  constructor(url, options = {}) {
    super();
    this.url = new URL(url);
    this.headers = options.headers ?? {};
    this.socket = null;
    this.buffer = Buffer.alloc(0);
    this.opened = false;
    this.closed = false;
    this.key = randomBytes(16).toString("base64");
    this.connect();
  }

  send(data) {
    if (!this.opened || this.closed || !this.socket) {
      throw new Error("WebSocket is not open");
    }
    const payload = Buffer.isBuffer(data) ? data : Buffer.from(data);
    this.socket.write(encodeFrame(payload, 0x2));
  }

  close() {
    if (this.closed) {
      return;
    }
    this.closed = true;
    try {
      if (this.opened && this.socket) {
        this.socket.write(encodeFrame(Buffer.alloc(0), 0x8));
      }
      this.socket?.end();
    } catch {}
  }

  connect() {
    const isSecure = this.url.protocol === "wss:";
    const port = Number(this.url.port || (isSecure ? 443 : 80));
    const host = this.url.hostname;
    const socket = isSecure
      ? tlsConnect({ host, port, servername: host })
      : netConnect({ host, port });

    this.socket = socket;
    const writeHandshake = () => {
      socket.write(this.buildHandshake());
    };
    if (isSecure) {
      socket.once("secureConnect", writeHandshake);
    } else {
      socket.once("connect", writeHandshake);
    }
    socket.on("data", (chunk) => {
      this.handleData(chunk);
    });
    socket.on("error", (error) => {
      this.emit("error", error);
    });
    socket.on("close", () => {
      this.closed = true;
      this.emit("close");
    });
  }

  buildHandshake() {
    const path = `${this.url.pathname || "/"}${this.url.search || ""}`;
    const lines = [
      `GET ${path} HTTP/1.1`,
      `Host: ${this.url.host}`,
      "Upgrade: websocket",
      "Connection: Upgrade",
      `Sec-WebSocket-Key: ${this.key}`,
      "Sec-WebSocket-Version: 13",
    ];

    for (const [key, value] of Object.entries(this.headers)) {
      if (value !== undefined && value !== null && value !== "") {
        lines.push(`${key}: ${value}`);
      }
    }

    return `${lines.join("\r\n")}\r\n\r\n`;
  }

  handleData(chunk) {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    if (!this.opened) {
      this.handleHandshake();
      if (!this.opened) {
        return;
      }
    }
    this.handleFrames();
  }

  handleHandshake() {
    const marker = this.buffer.indexOf("\r\n\r\n");
    if (marker < 0) {
      return;
    }

    const head = this.buffer.slice(0, marker).toString("utf8");
    this.buffer = this.buffer.slice(marker + 4);
    const statusLine = head.split("\r\n")[0] ?? "";
    if (!statusLine.includes(" 101 ")) {
      this.emit("error", new Error(`WebSocket handshake failed: ${statusLine}`));
      this.close();
      return;
    }

    const accept = getHeader(head, "sec-websocket-accept");
    const expected = createHash("sha1").update(`${this.key}${GUID}`).digest("base64");
    if (accept !== expected) {
      this.emit("error", new Error("WebSocket accept header mismatch"));
      this.close();
      return;
    }

    this.opened = true;
    this.emit("open");
  }

  handleFrames() {
    while (this.buffer.length >= 2) {
      const frame = decodeFrame(this.buffer);
      if (!frame) {
        return;
      }
      this.buffer = this.buffer.slice(frame.nextOffset);

      if (frame.opcode === 0x8) {
        this.close();
        return;
      }
      if (frame.opcode === 0x9) {
        this.socket?.write(encodeFrame(frame.payload, 0xa));
        continue;
      }
      if (frame.opcode === 0x1 || frame.opcode === 0x2) {
        this.emit("message", frame.payload);
      }
    }
  }
}

function encodeFrame(payload, opcode) {
  let headerLength = 2;
  if (payload.length >= 126 && payload.length <= 65535) {
    headerLength += 2;
  } else if (payload.length > 65535) {
    headerLength += 8;
  }
  headerLength += 4;

  const frame = Buffer.alloc(headerLength + payload.length);
  let offset = 0;
  frame[offset++] = 0x80 | opcode;
  if (payload.length < 126) {
    frame[offset++] = 0x80 | payload.length;
  } else if (payload.length <= 65535) {
    frame[offset++] = 0x80 | 126;
    frame.writeUInt16BE(payload.length, offset);
    offset += 2;
  } else {
    frame[offset++] = 0x80 | 127;
    frame.writeBigUInt64BE(BigInt(payload.length), offset);
    offset += 8;
  }

  const mask = randomBytes(4);
  mask.copy(frame, offset);
  offset += 4;
  for (let i = 0; i < payload.length; i += 1) {
    frame[offset + i] = payload[i] ^ mask[i % 4];
  }
  return frame;
}

function decodeFrame(buffer) {
  if (buffer.length < 2) {
    return null;
  }

  const opcode = buffer[0] & 0x0f;
  const masked = (buffer[1] & 0x80) !== 0;
  let length = buffer[1] & 0x7f;
  let offset = 2;

  if (length === 126) {
    if (buffer.length < offset + 2) {
      return null;
    }
    length = buffer.readUInt16BE(offset);
    offset += 2;
  } else if (length === 127) {
    if (buffer.length < offset + 8) {
      return null;
    }
    const bigLength = buffer.readBigUInt64BE(offset);
    if (bigLength > BigInt(Number.MAX_SAFE_INTEGER)) {
      throw new Error("WebSocket frame is too large");
    }
    length = Number(bigLength);
    offset += 8;
  }

  let mask = null;
  if (masked) {
    if (buffer.length < offset + 4) {
      return null;
    }
    mask = buffer.slice(offset, offset + 4);
    offset += 4;
  }

  if (buffer.length < offset + length) {
    return null;
  }

  const payload = Buffer.from(buffer.slice(offset, offset + length));
  if (mask) {
    for (let i = 0; i < payload.length; i += 1) {
      payload[i] ^= mask[i % 4];
    }
  }

  return {
    opcode,
    payload,
    nextOffset: offset + length,
  };
}

function getHeader(rawHeaders, name) {
  const lowerName = name.toLowerCase();
  for (const line of rawHeaders.split("\r\n").slice(1)) {
    const index = line.indexOf(":");
    if (index < 0) {
      continue;
    }
    if (line.slice(0, index).trim().toLowerCase() === lowerName) {
      return line.slice(index + 1).trim();
    }
  }
  return "";
}
