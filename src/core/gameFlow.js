import { makeGame } from "./gameState.js";
import { resetTTSState } from "../audio/ttsClient.js";
import { hideOverlay, showOverlay, updateOrientationLock, shouldPauseForOrientation } from "./ui.js";
import { requestPointerLock } from "../input/controls.js";
import { startEncounter } from "../waves/waves.js";
import { emitGameEvent } from "../dialogue/dialogueEvents.js";

export function startGame(runtime) {
  runtime.audio.init();
  runtime.audio.resume();

  runtime.mode = "playing";
  runtime.game = makeGame();
  runtime.resetCabbageChat?.();
  resetTTSState(runtime);
  runtime.game.musicState.nodesReady = runtime.audio.isReady();
  runtime.game.pausedForOrientation = shouldPauseForOrientation(runtime.clientProfile);
  updateOrientationLock(runtime, runtime.clientProfile);
  hideOverlay(runtime);
  if (!runtime.input.touch.enabled) {
    requestPointerLock(runtime);
  }
  startEncounter(runtime, 1);
}

export function gameOver(runtime) {
  const { game } = runtime;
  runtime.mode = "gameover";
  document.exitPointerLock?.();
  runtime.audio.setMusicMode(game, "none");
  updateOrientationLock(runtime, runtime.clientProfile);
  emitGameEvent(runtime, "game_over", {
    wave: game.wave,
    score: game.score,
    hp: 0,
  });
  showOverlay(runtime, {
    eyebrow: "SYSTEM OFFLINE",
    title: "白菜地被猪群拱翻了",
    lead: `你打爆了 ${game.kills} 只机器小猪，撑到第 ${game.wave} 波，得分 ${game.score}。`,
    button: "再来一局",
    hint: "按 R 也能立刻重开。",
  });
  runtime.audio.playSound(game, "fail");
}
