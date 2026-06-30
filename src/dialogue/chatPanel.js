import { normalizeBark } from "../ai/aiAdapter.js";
import { buildAISnapshot } from "../ai/buildAISnapshot.js";
import { resetTouchInput, syncFireInput } from "../input/controls.js";
import { enqueueDialogueReaction } from "./dialogueEvents.js";

const CHAT_ENDPOINT = "/api/ai-chat";
const CHAT_TIMEOUT_MS = 10000;
const CHAT_HISTORY_LIMIT = 20;

export function setupCabbageChat(runtime) {
  const { elements } = runtime;
  const chat = elements.cabbageChat;
  const form = elements.chatForm;
  const input = elements.chatInput;

  elements.chatToggle.addEventListener("click", () => {
    setChatCollapsed(runtime, !chat.classList.contains("collapsed"));
    if (!chat.classList.contains("collapsed")) {
      input.focus();
    }
  });

  elements.chatClose.addEventListener("click", () => {
    setChatCollapsed(runtime, true);
    input.blur();
  });

  input.addEventListener("focus", () => {
    pauseForChat(runtime, true);
  });
  input.addEventListener("blur", () => {
    pauseForChat(runtime, false);
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    sendChatMessage(runtime);
  });

  for (const chip of elements.chatChips.querySelectorAll("[data-chat-prompt]")) {
    chip.addEventListener("click", () => {
      input.value = chip.dataset.chatPrompt ?? "";
      setChatCollapsed(runtime, false);
      input.focus();
      form.requestSubmit();
    });
  }

  runtime.openCabbageChat = () => openCabbageChat(runtime);
  runtime.resetCabbageChat = () => resetCabbageChat(runtime);
}

export function resetCabbageChat(runtime) {
  const { chatMessages, chatInput, chatForm } = runtime.elements;
  chatMessages.innerHTML = '<p class="chat-empty">我在旁边。想说什么，直接告诉我。</p>';
  chatInput.value = "";
  chatInput.blur();
  chatForm.classList.remove("sending");
}

function setChatCollapsed(runtime, collapsed) {
  const { cabbageChat, chatToggle } = runtime.elements;
  cabbageChat.classList.toggle("collapsed", collapsed);
  chatToggle.setAttribute("aria-expanded", collapsed ? "false" : "true");
}

function openCabbageChat(runtime) {
  setChatCollapsed(runtime, false);
  runtime.elements.chatInput.focus();
}

async function sendChatMessage(runtime) {
  const { chatInput, chatForm } = runtime.elements;
  const message = chatInput.value.trim();
  if (!message || chatForm.classList.contains("sending")) {
    return;
  }

  chatInput.value = "";
  chatForm.classList.add("sending");
  addChatMessage(runtime, "user", message);

  try {
    const response = await requestChat(runtime, message);
    const reactions = Array.isArray(response?.reactions) ? response.reactions : [];
    if (!reactions.length) {
      throw new Error("empty chat response");
    }
    for (const reaction of reactions) {
      enqueueChatReaction(runtime, reaction);
    }
  } catch {
    enqueueChatReaction(runtime, {
      speaker: "cabbage",
      text: "我刚才卡了一下，但我还在。",
      intent: "chat_reply",
      emotion: "nervous",
      tone: "nervous",
      priority: 2,
      ttl: 3000,
      shouldSpeak: true,
      shouldVoice: false,
      voiceStyle: "small_nervous",
      interrupt: false,
      canBeDropped: false,
      delayMs: 0,
    });
  } finally {
    chatForm.classList.remove("sending");
  }
}

async function requestChat(runtime, message) {
  const snapshot = buildAISnapshot(
    runtime,
    { type: "player_chat", payload: {} },
    {
      eventType: "PLAYER_CHAT",
      speakerType: "cabbage",
      intentHint: "chat_reply",
      emotionHint: "nervous",
    }
  );
  const ai = runtime.game.dialogue.ai ?? {};
  const response = await requestWithTimeout(CHAT_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      message,
      gameSnapshot: snapshot,
      recentDialogue: snapshot.context?.recentDialogue ?? [],
      chatHistory: ai.chatHistory ?? [],
      avoidTexts: snapshot.context?.avoidTexts ?? [],
    }),
  });
  if (!response.ok) {
    return null;
  }
  return await response.json();
}

function enqueueChatReaction(runtime, reaction) {
  const bark = normalizeBark(reaction);
  if (!bark) {
    return;
  }
  const delayMs = Number.isFinite(bark.delayMs) ? bark.delayMs : 0;
  window.setTimeout(() => {
    addChatMessage(runtime, bark.speaker, bark.text);
    enqueueDialogueReaction(runtime, {
      ...bark,
      delayMs: 0,
      forceVoice: isCabbageSpeaker(bark.speaker),
    });
  }, Math.max(0, delayMs));
}

function addChatMessage(runtime, speaker, text) {
  const { chatMessages } = runtime.elements;
  const empty = chatMessages.querySelector(".chat-empty");
  if (empty) {
    empty.remove();
  }

  const item = document.createElement("p");
  item.className = `chat-message ${speaker}`;
  item.textContent = speaker === "user" ? text : `${speakerName(speaker)}：${text}`;
  chatMessages.appendChild(item);
  chatMessages.scrollTop = chatMessages.scrollHeight;

  const ai = runtime.game.dialogue.ai;
  if (ai) {
    ai.chatHistory.push({
      speaker,
      text,
      time: runtime.game.time,
    });
    ai.chatHistory = ai.chatHistory.slice(-CHAT_HISTORY_LIMIT);
    runtime.game.dialogue.chatHistory = ai.chatHistory;
  }
}

function pauseForChat(runtime, paused) {
  if (runtime.mode === "playing") {
    runtime.game.pausedForChat = paused;
  }
  if (!paused) {
    return;
  }
  const { input } = runtime;
  input.keys.clear();
  input.lookX = 0;
  input.mouseFire = false;
  input.keyFire = false;
  input.touchFire = false;
  resetTouchInput(runtime);
  syncFireInput(runtime);
  document.exitPointerLock?.();
}

async function requestWithTimeout(url, options) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), CHAT_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    window.clearTimeout(timer);
  }
}

function speakerName(speaker) {
  if (speaker === "pigKing" || speaker === "boss") {
    return "猪王";
  }
  if (speaker === "cabbage" || speaker === "cabbageSpirit") {
    return "小白菜";
  }
  if (speaker === "pig") {
    return "机器猪";
  }
  return "系统";
}

function isCabbageSpeaker(speaker) {
  return speaker === "cabbage" || speaker === "cabbageSpirit";
}
