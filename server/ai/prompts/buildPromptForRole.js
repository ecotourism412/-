import { getRoleConfig } from "../roleRouter.js";
import { sharedRulesZh } from "./sharedRules.zh.js";

export async function buildPromptForRole({
  eventType,
  speakerType,
  gameSnapshot,
  recentDialogue = [],
  toneHint,
  intentHint,
  emotionHint,
  priority,
  avoidTexts = [],
  playerMessage = "",
}) {
  const role = await getRoleConfig(speakerType);
  const styleReferences = role.examples?.[eventType] ?? [];
  const outputSchema = {
    ...role.outputDefaults,
    intent: intentHint ?? role.outputDefaults.intent ?? "encourage",
    emotion: emotionHint ?? role.outputDefaults.emotion ?? role.outputDefaults.tone,
    tone: toneHint ?? role.eventToneHints?.[eventType] ?? role.outputDefaults.tone,
    priority: priority ?? role.outputDefaults.priority,
    text: getTextRule(role.speaker),
  };

  const system = [
    `角色：${role.displayName} (${role.speaker})`,
    `身份：${role.identity}`,
    `性格：${joinRules(role.personality)}`,
    `表达规则：${joinRules(role.styleRules)}`,
    `共用规则：${joinRules(sharedRulesZh)}`,
    "风格参考只用于学习节奏、语气和角色味道，禁止原样输出或只替换一两个词。",
    `输出 JSON schema：${JSON.stringify(outputSchema)}`,
    "必须包含 intent、emotion、text。只返回一个顶层 JSON 对象，不要包在 reaction 字段里。",
  ].join("\n");

  const user = [
    `当前事件：${eventType}`,
    `当前说话角色：${speakerType}`,
    `意图提示：${outputSchema.intent}`,
    `情绪提示：${outputSchema.emotion}`,
    `tone 建议：${outputSchema.tone}`,
    `priority 建议：${outputSchema.priority}`,
    `风格参考（禁止照抄）：${styleReferences.length ? styleReferences.join(" / ") : "无"}`,
    `最近禁止重复：${JSON.stringify(Array.isArray(avoidTexts) ? avoidTexts.slice(-8) : [])}`,
    playerMessage ? `玩家刚刚对你说：${playerMessage}` : "",
    `游戏上下文：${JSON.stringify(gameSnapshot ?? {})}`,
    `最近对白：${JSON.stringify(Array.isArray(recentDialogue) ? recentDialogue.slice(-6) : [])}`,
    "必须结合当前事件、本局记忆和最近对白生成新句子。",
    "不要复述风格参考，不要近似改写风格参考。",
    "只为当前角色生成一句中文短对白，并返回严格 JSON。",
  ].filter(Boolean).join("\n");

  return {
    speakerType,
    eventType,
    role,
    styleReferences,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    prompt: `${system}\n\n${user}`,
  };
}

function joinRules(items) {
  return Array.isArray(items) ? items.join("；") : "";
}

function getTextRule(speaker) {
  if (speaker === "pig") {
    return "不超过10个中文字";
  }
  if (speaker === "pigKing") {
    return "不超过30个中文字";
  }
  return "不超过25个中文字";
}
