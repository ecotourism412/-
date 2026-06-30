import { createAudioSystem } from "./audio/audio.js";
import { createTTSState } from "./audio/ttsClient.js";
import { makeGame } from "./core/gameState.js";
import { startGame } from "./core/gameFlow.js";
import { frame } from "./core/loop.js";
import { applyClientProfile, refreshClientProfile, showOverlay, showToast, syncViewportMetrics } from "./core/ui.js";
import { setupCabbageChat } from "./dialogue/chatPanel.js";
import { createInputState, setupControls } from "./input/controls.js";
import { detectClientProfile } from "./input/deviceProfile.js";
import { createRenderAssets } from "./render/renderer.js";

const stage = document.querySelector(".stage");
const canvas = document.getElementById("game");
const canvasContext = canvas.getContext("2d");

canvasContext.imageSmoothingEnabled = false;

const elements = {
  stage,
  overlay: document.getElementById("overlay"),
  overlayEyebrow: document.getElementById("overlayEyebrow"),
  overlayTitle: document.getElementById("overlayTitle"),
  overlayLead: document.getElementById("overlayLead"),
  overlayHint: document.getElementById("overlayHint"),
  startButton: document.getElementById("startButton"),
  toast: document.getElementById("toast"),
  cabbageChat: document.getElementById("cabbageChat"),
  chatToggle: document.getElementById("chatToggle"),
  chatClose: document.getElementById("chatClose"),
  chatMessages: document.getElementById("chatMessages"),
  chatChips: document.querySelector(".chat-chips"),
  chatForm: document.getElementById("chatForm"),
  chatInput: document.getElementById("chatInput"),
  chatSend: document.getElementById("chatSend"),
  mobileControls: document.getElementById("mobileControls"),
  movePad: document.getElementById("movePad"),
  moveKnob: document.getElementById("moveKnob"),
  lookZone: document.getElementById("lookZone"),
  fireButton: document.getElementById("fireButton"),
  boostButton: document.getElementById("boostButton"),
  orientationLock: document.getElementById("orientationLock"),
  orientationMessage: document.getElementById("orientationMessage"),
};

const runtime = {
  stage,
  canvas,
  canvasContext,
  elements,
  input: createInputState(),
  audio: createAudioSystem(),
  tts: createTTSState(),
  renderAssets: createRenderAssets(),
  mode: "intro",
  game: makeGame(),
  lastFrame: performance.now(),
  clientProfile: detectClientProfile(),
  startGame: null,
  showToast: null,
};

runtime.startGame = () => startGame(runtime);
runtime.showToast = (message) => showToast(runtime, message);

showOverlay(runtime, {
  eyebrow: "AI CABBAGE DEFENSE",
  title: "保卫白菜",
  lead: "守住霓虹白菜地，第二波就会撞上想拱菜的超巨型机器猪王。",
  button: "点击开始",
  hint: "桌面和手机都能玩，左摇杆移动、右侧拖拽转向。",
});

applyClientProfile(runtime, runtime.clientProfile, false);
setupControls(runtime);
setupCabbageChat(runtime);
setupViewportListeners(runtime);

requestAnimationFrame((now) => frame(runtime, now));

function setupViewportListeners(runtime) {
  window.addEventListener("resize", () => {
    refreshClientProfile(runtime, false);
  });

  window.addEventListener("orientationchange", () => {
    window.setTimeout(() => {
      refreshClientProfile(runtime, true);
    }, 120);
  });

  window.visualViewport?.addEventListener("resize", () => {
    syncViewportMetrics();
    refreshClientProfile(runtime, false);
  });

  window.visualViewport?.addEventListener("scroll", () => {
    syncViewportMetrics();
  });
}
