import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { setDefaultResultOrder } from "node:dns";
import { spawn } from "node:child_process";

const DEFAULT_BASE_URL = "https://aihubmix.com/v1";
const DEFAULT_TIMEOUT_MS = 15000;
const AUTO_NODE_ATTEMPT_MS = 2500;
const PLACEHOLDER_KEYS = new Set(["", "PASTE_YOUR_KEY_HERE", "your_api_key_here"]);
const PYTHON_CHAT_SCRIPT = String.raw`
import json
import sys
import urllib.error
import urllib.request

request = json.load(sys.stdin)
body = json.dumps(request["payload"], ensure_ascii=False).encode("utf-8")
http_request = urllib.request.Request(
    request["url"],
    data=body,
    headers={
        "Authorization": "Bearer " + request["apiKey"],
        "Content-Type": "application/json",
    },
    method="POST",
)

try:
    with urllib.request.urlopen(http_request, timeout=request["timeoutSeconds"]) as response:
        sys.stdout.write(response.read().decode("utf-8", "ignore"))
except urllib.error.HTTPError as error:
    error_body = error.read().decode("utf-8", "ignore")
    sys.stderr.write(json.dumps({
        "status": error.code,
        "body": error_body[:500],
    }, ensure_ascii=False))
    sys.exit(2)
except Exception as error:
    sys.stderr.write(json.dumps({
        "error": error.__class__.__name__,
        "message": str(error)[:500],
    }, ensure_ascii=False))
    sys.exit(1)
`;

try {
  setDefaultResultOrder("ipv4first");
} catch {}

export async function callModelForRole(role, promptBundle) {
  const modelConfig = buildModelConfig(role);
  if (PLACEHOLDER_KEYS.has(modelConfig.apiKey.trim())) {
    throw new Error("TUJILISHIDAI_API_KEY is missing");
  }

  const content = await callTuijilishidaiChat({
    apiKey: modelConfig.apiKey,
    baseUrl: modelConfig.baseUrl,
    model: modelConfig.model,
    messages: promptBundle.messages,
    temperature: modelConfig.temperature,
    maxTokens: modelConfig.maxTokens,
    timeoutMs: modelConfig.timeoutMs,
    disableThinking: modelConfig.disableThinking,
    httpClient: modelConfig.httpClient,
  });

  return parseModelJson(content);
}

export function buildModelConfig(role) {
  const env = getServerEnv();
  const roleConfig = role.modelConfig ?? {};
  const model = env[roleConfig.modelEnvKey] || roleConfig.fallbackModel;
  const timeoutMs = parsePositiveInt(env.TUJILISHIDAI_TIMEOUT_MS) ?? DEFAULT_TIMEOUT_MS;

  return {
    provider: roleConfig.provider ?? "tuijilishidai",
    apiKey: env.TUJILISHIDAI_API_KEY ?? "",
    baseUrl: trimTrailingSlash(env.TUJILISHIDAI_BASE_URL || DEFAULT_BASE_URL),
    model,
    temperature: roleConfig.temperature ?? 0.8,
    maxTokens: roleConfig.maxTokens ?? 80,
    timeoutMs,
    disableThinking: Boolean(roleConfig.disableThinking),
    httpClient: env.TUJILISHIDAI_HTTP_CLIENT || "auto",
  };
}

export async function callTuijilishidaiChat({
  apiKey,
  baseUrl,
  model,
  messages,
  temperature,
  maxTokens,
  timeoutMs,
  disableThinking,
  httpClient = "auto",
}) {
  if (!model) {
    throw new Error("model is missing");
  }

  const payload = {
    model,
    messages,
    temperature,
    max_tokens: maxTokens,
    response_format: { type: "json_object" },
  };
  if (disableThinking) {
    payload.enable_thinking = false;
  }

  const url = `${trimTrailingSlash(baseUrl)}/chat/completions`;
  const bodyText = await requestChatCompletion({
    apiKey,
    url,
    payload,
    timeoutMs,
    httpClient,
  });

  const body = parseModelJson(bodyText);
  const content = extractAssistantContent(body);
  if (!content) {
    throw new Error("assistant content is empty");
  }
  return content;
}

export function parseModelJson(text) {
  if (text && typeof text === "object") {
    return text;
  }
  if (typeof text !== "string") {
    throw new Error("model response is not text");
  }

  const cleaned = stripCodeFence(text.trim());
  try {
    return JSON.parse(cleaned);
  } catch {
    const jsonText = extractFirstJsonObject(cleaned);
    if (!jsonText) {
      throw new Error("model response is not JSON");
    }
    return JSON.parse(jsonText);
  }
}

function extractAssistantContent(body) {
  const content = body?.choices?.[0]?.message?.content;
  if (typeof content === "string") {
    return content;
  }
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") {
          return part;
        }
        return part?.text ?? "";
      })
      .join("")
      .trim();
  }
  return "";
}

async function requestChatCompletion({ apiKey, url, payload, timeoutMs, httpClient }) {
  const mode = ["node", "python", "auto"].includes(httpClient) ? httpClient : "auto";
  if (mode === "python") {
    return await requestWithPython({ apiKey, url, payload, timeoutMs });
  }
  if (mode === "node") {
    return await requestWithFetch({ apiKey, url, payload, timeoutMs });
  }

  try {
    return await requestWithFetch({
      apiKey,
      url,
      payload,
      timeoutMs: Math.min(timeoutMs, AUTO_NODE_ATTEMPT_MS),
    });
  } catch (fetchError) {
    try {
      return await requestWithPython({ apiKey, url, payload, timeoutMs });
    } catch (pythonError) {
      throw new Error(`Tuijilishidai request failed: ${pythonError.message || fetchError.message}`);
    }
  }
}

async function requestWithFetch({ apiKey, url, payload, timeoutMs }) {
  if (typeof fetch !== "function") {
    throw new Error("fetch is unavailable in this runtime");
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    const bodyText = await response.text();
    if (!response.ok) {
      throw new Error(`Tuijilishidai request failed: ${response.status}`);
    }
    return bodyText;
  } finally {
    clearTimeout(timer);
  }
}

async function requestWithPython({ apiKey, url, payload, timeoutMs }) {
  const python = process.env.TUJILISHIDAI_PYTHON_BIN || process.env.PYTHON || "python3";
  const timeoutSeconds = Math.max(1, Math.ceil(timeoutMs / 1000));
  const input = JSON.stringify({ apiKey, url, payload, timeoutSeconds });

  return await new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(python, ["-c", PYTHON_CHAT_SCRIPT], {
      stdio: ["pipe", "pipe", "pipe"],
      env: {
        ...process.env,
        PYTHONIOENCODING: "utf-8",
      },
    });
    const stdout = [];
    const stderr = [];
    let settled = false;

    const timer = setTimeout(() => {
      fail(new Error("Tuijilishidai Python request timed out"));
      child.kill("SIGKILL");
    }, timeoutMs + 1000);

    child.stdout.on("data", (chunk) => stdout.push(chunk));
    child.stderr.on("data", (chunk) => stderr.push(chunk));
    child.on("error", fail);
    child.on("close", (code) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      if (code !== 0) {
        rejectPromise(new Error(summarizePythonError(Buffer.concat(stderr).toString("utf8"))));
        return;
      }
      resolvePromise(Buffer.concat(stdout).toString("utf8"));
    });
    child.stdin.end(input);

    function fail(error) {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      rejectPromise(error);
    }
  });
}

function summarizePythonError(stderr) {
  const trimmed = String(stderr || "").trim();
  if (!trimmed) {
    return "Tuijilishidai Python request failed";
  }
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed.status) {
      return `Tuijilishidai request failed: ${parsed.status}`;
    }
    return parsed.message || parsed.error || "Tuijilishidai Python request failed";
  } catch {
    return trimmed.slice(0, 240);
  }
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
        }),
    );
  } catch {
    return {};
  }
}

function parsePositiveInt(value) {
  const number = Number.parseInt(value, 10);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function trimTrailingSlash(value) {
  return String(value || DEFAULT_BASE_URL).replace(/\/+$/, "");
}

function stripCodeFence(text) {
  return text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
}

function extractFirstJsonObject(text) {
  const start = text.indexOf("{");
  if (start < 0) {
    return "";
  }

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < text.length; index += 1) {
    const char = text[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (inString) {
      continue;
    }
    if (char === "{") {
      depth += 1;
    }
    if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return text.slice(start, index + 1);
      }
    }
  }
  return "";
}
