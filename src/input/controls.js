import { TOUCH_LOOK_SENSITIVITY } from "../core/constants.js";

export function createInputState() {
  return {
    keys: new Set(),
    lookX: 0,
    fire: false,
    mouseFire: false,
    keyFire: false,
    touchFire: false,
    touch: {
      enabled: false,
      movePointerId: null,
      lookPointerId: null,
      firePointerId: null,
      boostPointerId: null,
      moveX: 0,
      moveY: 0,
      boost: false,
      lastLookX: 0,
      lastLookY: 0,
    },
  };
}

export function setupControls(runtime) {
  const { canvas, elements, input } = runtime;
  const { stage, startButton, movePad, lookZone, fireButton, boostButton } = elements;

  startButton.addEventListener("click", () => {
    runtime.startGame();
  });

  canvas.addEventListener("mousedown", (event) => {
    if (event.button !== 0) {
      return;
    }

    runtime.audio.resume();
    input.mouseFire = true;
    syncFireInput(runtime);
    if (runtime.mode !== "playing") {
      runtime.startGame();
      return;
    }
    requestPointerLock(runtime);
  });

  window.addEventListener("mouseup", (event) => {
    if (event.button === 0) {
      input.mouseFire = false;
      syncFireInput(runtime);
    }
  });

  window.addEventListener("keydown", (event) => {
    if (isChatInputEvent(event)) {
      return;
    }
    const key = event.key.toLowerCase();
    input.keys.add(key);

    if (key === " ") {
      input.keyFire = false;
      syncFireInput(runtime);
      runtime.openCabbageChat?.();
      event.preventDefault();
      return;
    }

    if (key === "r" && runtime.mode !== "playing") {
      runtime.startGame();
    }
  });

  window.addEventListener("keyup", (event) => {
    if (isChatInputEvent(event)) {
      return;
    }
    const key = event.key.toLowerCase();
    input.keys.delete(key);
    if (key === " ") {
      input.keyFire = false;
      syncFireInput(runtime);
      event.preventDefault();
    }
  });

  window.addEventListener("blur", () => {
    input.keys.clear();
    input.mouseFire = false;
    input.keyFire = false;
    input.lookX = 0;
    resetTouchInput(runtime);
    syncFireInput(runtime);
  });

  document.addEventListener("mousemove", (event) => {
    if (document.pointerLockElement === canvas && runtime.mode === "playing") {
      input.lookX += event.movementX;
    }
  });

  document.addEventListener("pointerlockchange", () => {
    if (runtime.mode === "playing") {
      runtime.showToast(
        document.pointerLockElement === canvas
          ? "鼠标锁定，可直接瞄准机猪。"
          : "鼠标已释放，也可以用 Q / E 或方向键转向。"
      );
    }
  });

  stage.addEventListener("pointerdown", (event) => {
    if (event.pointerType === "touch") {
      setTouchMode(runtime, true);
    }
  });

  movePad.addEventListener("pointerdown", (event) => {
    if (event.pointerType !== "touch") {
      return;
    }
    event.preventDefault();
    beginTouchInteraction(runtime);
    input.touch.movePointerId = event.pointerId;
    movePad.setPointerCapture?.(event.pointerId);
    updateTouchMove(runtime, event);
  });

  movePad.addEventListener("pointermove", (event) => {
    if (event.pointerId !== input.touch.movePointerId) {
      return;
    }
    event.preventDefault();
    updateTouchMove(runtime, event);
  });

  lookZone.addEventListener("pointerdown", (event) => {
    if (event.pointerType !== "touch") {
      return;
    }
    event.preventDefault();
    beginTouchInteraction(runtime);
    input.touch.lookPointerId = event.pointerId;
    input.touch.lastLookX = event.clientX;
    input.touch.lastLookY = event.clientY;
    lookZone.setPointerCapture?.(event.pointerId);
  });

  lookZone.addEventListener("pointermove", (event) => {
    if (event.pointerId !== input.touch.lookPointerId) {
      return;
    }
    event.preventDefault();
    const deltaX = event.clientX - input.touch.lastLookX;
    input.lookX += deltaX * TOUCH_LOOK_SENSITIVITY;
    input.touch.lastLookX = event.clientX;
    input.touch.lastLookY = event.clientY;
  });

  fireButton.addEventListener("pointerdown", (event) => {
    if (event.pointerType !== "touch") {
      return;
    }
    event.preventDefault();
    beginTouchInteraction(runtime);
    input.touch.firePointerId = event.pointerId;
    input.touchFire = true;
    syncFireInput(runtime);
    fireButton.classList.add("active");
    fireButton.setPointerCapture?.(event.pointerId);
  });

  boostButton.addEventListener("pointerdown", (event) => {
    if (event.pointerType !== "touch") {
      return;
    }
    event.preventDefault();
    beginTouchInteraction(runtime);
    input.touch.boostPointerId = event.pointerId;
    input.touch.boost = true;
    boostButton.classList.add("active");
    boostButton.setPointerCapture?.(event.pointerId);
  });

  window.addEventListener("pointerup", (event) => releaseTouchPointer(runtime, event));
  window.addEventListener("pointercancel", (event) => releaseTouchPointer(runtime, event));
}

function isChatInputEvent(event) {
  const target = event.target;
  return Boolean(
    target instanceof HTMLElement &&
      (target.closest(".cabbage-chat") || ["input", "textarea", "select"].includes(target.tagName.toLowerCase()))
  );
}

export function requestPointerLock(runtime) {
  if (runtime.input.touch.enabled) {
    return;
  }
  if (document.pointerLockElement !== runtime.canvas) {
    runtime.canvas.requestPointerLock?.().catch?.(() => {});
  }
}

export function setTouchMode(runtime, enabled) {
  const { input, elements } = runtime;
  const changed = input.touch.enabled !== enabled;
  input.touch.enabled = enabled;
  elements.mobileControls.classList.toggle("enabled", enabled);
  elements.mobileControls.setAttribute("aria-hidden", enabled ? "false" : "true");
  if (enabled) {
    document.exitPointerLock?.();
  } else if (changed) {
    resetTouchInput(runtime);
    syncFireInput(runtime);
  }
}

export function syncFireInput(runtime) {
  const { input } = runtime;
  input.fire = input.mouseFire || input.keyFire || input.touchFire;
}

export function resetTouchInput(runtime) {
  const { input } = runtime;
  input.touch.movePointerId = null;
  input.touch.lookPointerId = null;
  input.touch.firePointerId = null;
  input.touch.boostPointerId = null;
  input.touch.moveX = 0;
  input.touch.moveY = 0;
  input.touch.boost = false;
  input.touch.lastLookX = 0;
  input.touch.lastLookY = 0;
  input.touchFire = false;
  updateTouchUi(runtime);
}

function beginTouchInteraction(runtime) {
  setTouchMode(runtime, true);
  runtime.audio.resume();
}

function updateTouchMove(runtime, event) {
  const { input, elements } = runtime;
  const rect = elements.movePad.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  const radius = rect.width * 0.34;
  let dx = (event.clientX - centerX) / radius;
  let dy = (event.clientY - centerY) / radius;
  const magnitude = Math.hypot(dx, dy);
  if (magnitude > 1) {
    dx /= magnitude;
    dy /= magnitude;
  }
  input.touch.moveX = dx;
  input.touch.moveY = dy;
  updateTouchUi(runtime);
}

function updateTouchUi(runtime) {
  const { input, elements } = runtime;
  const knobTravel = elements.movePad.clientWidth * 0.26;
  elements.moveKnob.style.transform = `translate3d(${input.touch.moveX * knobTravel}px, ${input.touch.moveY * knobTravel}px, 0)`;
  elements.movePad.classList.toggle("active", input.touch.movePointerId !== null);
  elements.fireButton.classList.toggle("active", input.touchFire);
  elements.boostButton.classList.toggle("active", input.touch.boost);
}

function releaseTouchPointer(runtime, event) {
  const { input } = runtime;
  if (event.pointerId === input.touch.movePointerId) {
    input.touch.movePointerId = null;
    input.touch.moveX = 0;
    input.touch.moveY = 0;
  }

  if (event.pointerId === input.touch.lookPointerId) {
    input.touch.lookPointerId = null;
    input.touch.lastLookX = 0;
    input.touch.lastLookY = 0;
  }

  if (event.pointerId === input.touch.firePointerId) {
    input.touch.firePointerId = null;
    input.touchFire = false;
    syncFireInput(runtime);
  }

  if (event.pointerId === input.touch.boostPointerId) {
    input.touch.boostPointerId = null;
    input.touch.boost = false;
  }

  updateTouchUi(runtime);
}
