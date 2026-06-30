import { createAIChatResponse } from "../../server/ai/aiChat.js";

export async function handler(event) {
  if (event.httpMethod !== "POST") {
    return json({ ok: false, error: "Method not allowed" }, 405);
  }

  try {
    const body = event.body ? JSON.parse(event.body) : {};
    const result = await createAIChatResponse(body);
    return json(result, result.ok ? 200 : 400);
  } catch (error) {
    return json({ ok: false, error: error.message || "AI chat failed" }, 400);
  }
}

function json(body, statusCode) {
  return {
    statusCode,
    headers: { "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify(body),
  };
}
