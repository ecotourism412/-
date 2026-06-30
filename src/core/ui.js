import { resetTouchInput, setTouchMode, syncFireInput } from "../input/controls.js";
import { detectClientProfile } from "../input/deviceProfile.js";

export function showOverlay(runtime, config) {
  const { elements } = runtime;
  elements.overlayEyebrow.textContent = config.eyebrow;
  elements.overlayTitle.textContent = config.title;
  elements.overlayLead.textContent = config.lead;
  elements.overlayHint.textContent = config.hint;
  elements.startButton.textContent = config.button;
  elements.overlay.classList.remove("hidden");
}

export function hideOverlay(runtime) {
  runtime.elements.overlay.classList.add("hidden");
}

export function showToast(runtime, message) {
  const { toast } = runtime.elements;
  toast.textContent = message;
  toast.classList.add("visible");
  clearTimeout(showToast.timerId);
  showToast.timerId = setTimeout(() => {
    toast.classList.remove("visible");
  }, 1800);
}

export function refreshClientProfile(runtime, announce) {
  applyClientProfile(runtime, detectClientProfile(), announce);
}

export function applyClientProfile(runtime, profile, announce) {
  const previousMode = runtime.clientProfile?.kind;
  const previousOrientation = runtime.clientProfile?.orientation;
  runtime.clientProfile = profile;

  syncViewportMetrics();
  document.documentElement.dataset.device = profile.kind;
  document.documentElement.dataset.orientation = profile.orientation;
  setTouchMode(runtime, profile.touchUi);
  updateOrientationLock(runtime, profile);

  if (runtime.mode === "playing") {
    runtime.game.pausedForOrientation = shouldPauseForOrientation(profile);
    if (runtime.game.pausedForOrientation) {
      runtime.input.lookX = 0;
      runtime.input.mouseFire = false;
      runtime.input.keyFire = false;
      resetTouchInput(runtime);
      syncFireInput(runtime);
    }
  }

  if (runtime.mode === "intro") {
    runtime.elements.overlayHint.textContent =
      profile.kind === "mobile"
        ? profile.orientation === "portrait"
          ? "检测到 iPhone Safari 竖屏，请先横屏再开始。"
          : "检测到手机浏览器，左摇杆移动、右侧拖拽转向。"
        : "检测到桌面浏览器，点击画面可锁定鼠标。";
  }

  if (
    announce &&
    runtime.mode === "playing" &&
    (previousMode !== profile.kind || previousOrientation !== profile.orientation)
  ) {
    if (profile.kind === "mobile") {
      showToast(
        runtime,
        profile.orientation === "portrait" ? "已切换到手机竖屏模式。" : "已切换到手机横屏模式。"
      );
    } else {
      showToast(runtime, "已切换到桌面浏览器模式。");
    }
  }
}

export function syncViewportMetrics() {
  const viewport = window.visualViewport;
  const width = viewport ? viewport.width : window.innerWidth;
  const height = viewport ? viewport.height : window.innerHeight;
  document.documentElement.style.setProperty("--viewport-width", `${Math.round(width)}px`);
  document.documentElement.style.setProperty("--viewport-height", `${Math.round(height)}px`);
}

export function shouldPauseForOrientation(profile) {
  return profile.kind === "mobile" && profile.orientation === "portrait";
}

export function updateOrientationLock(runtime, profile) {
  const visible = shouldPauseForOrientation(profile);
  const { orientationLock, orientationMessage } = runtime.elements;
  orientationLock.classList.toggle("visible", visible);
  orientationLock.setAttribute("aria-hidden", visible ? "false" : "true");
  orientationMessage.textContent =
    runtime.mode === "playing"
      ? "旋转手机到横屏后会自动继续战斗。"
      : "旋转手机到横屏后再点击开始。";
}
