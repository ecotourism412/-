import { createAIReaction } from "../../server/ai/aiReaction.js";

export async function handler(event) {
  if (event.httpMethod !== "POST") {
    return json({ ok: false, error: "Method not allowed" }, 405);
  }

  try {
    const body = event.body ? JSON.parse(event.body) : {};
    const result = await createAIReaction(body);
    return json(result, 200);
  } catch (error) {
    return json({ ok: false, error: error.message || "AI reaction failed" }, 400);
  }
}

function json(body, statusCode) {
  return {
    statusCode,
    headers: { "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify(body),
  };
}
