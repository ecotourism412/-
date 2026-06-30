import { fireShot } from "../combat/shooting.js";
import { updateEffects, updateScreenShake, updateShockwaves } from "../combat/fieldEffects.js";
import { updateBoss } from "../entities/boss.js";
import { updateCabbageSpirit } from "../entities/cabbageSpirit.js";
import { applyLook, movePlayer } from "../entities/player.js";
import { updatePigs } from "../entities/pig.js";
import { updateWave } from "../waves/waves.js";
import { render } from "../render/renderer.js";
import { updateDialogue } from "../dialogue/dialogueState.js";
import { emitGameEvent } from "../dialogue/dialogueEvents.js";
import { gameOver } from "./gameFlow.js";

export function frame(runtime, now) {
  const dt = Math.min(0.033, (now - runtime.lastFrame) / 1000 || 0.016);
  runtime.lastFrame = now;

  if (runtime.mode === "playing" && !runtime.game.pausedForOrientation && !runtime.game.pausedForChat) {
    update(runtime, dt);
  } else if (runtime.mode === "playing") {
    runtime.audio.updateMusic(runtime.game);
  }

  render(runtime);
  requestAnimationFrame((nextNow) => frame(runtime, nextNow));
}

export function update(runtime, dt) {
  const { game, input } = runtime;
  const player = game.player;
  game.time += dt;
  player.cooldown = Math.max(0, player.cooldown - dt);
  player.recoil = Math.max(0, player.recoil - dt * 7);
  player.flash = Math.max(0, player.flash - dt * 3.6);
  player.muzzle = Math.max(0, player.muzzle - dt * 6);
  game.hurtSoundTimer = Math.max(0, game.hurtSoundTimer - dt);
  game.screenPulse = Math.max(0, game.screenPulse - dt * 2.6);

  updateScreenShake(game, dt);
  applyLook(runtime, dt);
  movePlayer(runtime, dt);
  updateCabbageSpirit(runtime, dt);

  if (input.fire && player.cooldown <= 0) {
    fireShot(runtime);
  }

  updatePigs(runtime, dt);
  updateBoss(runtime, dt);
  updateShockwaves(runtime, dt);
  updateEffects(game, dt);
  updateWave(runtime, dt);
  updateDialogue(game.dialogue, dt);
  maybeEmitLowHp(runtime);
  runtime.audio.updateMusic(game);

  if (player.hp <= 0) {
    player.hp = 0;
    gameOver(runtime);
  }
}

function maybeEmitLowHp(runtime) {
  const { game } = runtime;
  const hpRatio = game.player.hp / game.player.maxHp;
  if (hpRatio <= 0.35 && !game.lowHpWarningPlayed) {
    game.lowHpWarningPlayed = true;
    emitGameEvent(runtime, "player_low_hp", {
      wave: game.wave,
      hp: game.player.hp,
      score: game.score,
    });
  }
  if (hpRatio > 0.62) {
    game.lowHpWarningPlayed = false;
  }
}
