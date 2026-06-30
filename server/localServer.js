import { createReadStream, existsSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { createServer } from "node:http";
import { createAIReaction } from "./ai/aiReaction.js";
import { createAIChatResponse } from "./ai/aiChat.js";
import { createTTSResponse } from "./tts/ttsHandler.js";

const ROOT = resolve(process.cwd());
const PORT = Number.parseInt(process.env.PORT ?? "8000", 10);
const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

createServer(async (req, res) => {
  try {
    if (req.method === "POST" && req.url === "/api/ai-reaction") {
      await handleJsonApi(req, res, createAIReaction);
      return;
    }
    if (req.method === "POST" && req.url === "/api/ai-chat") {
      await handleJsonApi(req, res, createAIChatResponse);
      return;
    }
    if (req.method === "POST" && req.url === "/api/tts") {
      await handleJsonApi(req, res, createTTSResponse);
      return;
    }
    if (req.url?.startsWith("/api/")) {
      sendJson(res, { ok: false, error: "Not found" }, 404);
      return;
    }

    serveStatic(req, res);
  } catch (error) {
    sendJson(res, { ok: false, error: error.message || "Local server failed" }, 500);
  }
}).listen(PORT, () => {
  console.log(`保卫白菜 local server: http://localhost:${PORT}/`);
});

async function handleJsonApi(req, res, handler) {
  if (req.method !== "POST") {
    sendJson(res, { ok: false, error: "Method not allowed" }, 405);
    return;
  }

  const body = await readJsonBody(req);
  const result = await handler(body);
  sendJson(res, result, 200);
}

function serveStatic(req, res) {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  const pathname = decodeURIComponent(url.pathname);
  const relative = pathname === "/" ? "index.html" : pathname.slice(1);
  const filePath = resolve(ROOT, normalize(relative));

  if (!filePath.startsWith(ROOT) || filePath.includes(`${ROOT}/.env`)) {
    sendText(res, "Forbidden", 403);
    return;
  }

  const finalPath = existsSync(filePath) ? filePath : join(ROOT, "index.html");
  const stream = createReadStream(finalPath);
  stream.on("error", () => sendText(res, "Not found", 404));
  res.writeHead(200, {
    "content-type": MIME_TYPES[extname(finalPath)] ?? "application/octet-stream",
    "cache-control": finalPath.endsWith("index.html") ? "no-cache, no-store, must-revalidate" : "no-cache",
  });
  stream.pipe(res);
}

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

function sendJson(res, body, statusCode) {
  res.writeHead(statusCode, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

function sendText(res, body, statusCode) {
  res.writeHead(statusCode, { "content-type": "text/plain; charset=utf-8" });
  res.end(body);
}
