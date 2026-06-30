import { createTTSResponse } from "../../server/tts/ttsHandler.js";

export async function handler(event) {
  if (event.httpMethod !== "POST") {
    return json({ ok: false, error: "Method not allowed" }, 405);
  }

  try {
    const body = event.body ? JSON.parse(event.body) : {};
    const result = await createTTSResponse(body);
    return json(result, 200);
  } catch (error) {
    return json({ ok: false, error: error.message || "TTS request failed" }, 400);
  }
}

function json(body, statusCode) {
  return {
    statusCode,
    headers: { "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify(body),
  };
}
