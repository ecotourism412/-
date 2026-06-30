import { colors } from "../core/constants.js";
import { addShake, pulseScreen } from "../core/effects.js";
import { clamp, lerp } from "../core/math3d.js";
import { emitGameEvent } from "../dialogue/dialogueEvents.js";

export function updateScreenShake(game, dt) {
  const shake = game.screenShake;
  shake.time = Math.max(0, shake.time - dt);
  shake.strength = lerp(shake.strength, 0, dt * 8);
  if (shake.time > 0.001 && shake.strength > 0.01) {
    const amplitude = shake.strength * 7;
    shake.x = (Math.random() * 2 - 1) * amplitude;
    shake.y = (Math.random() * 2 - 1) * amplitude * 0.8;
  } else {
    shake.x = 0;
    shake.y = 0;
  }
}

export function updateShockwaves(runtime, dt) {
  const { game } = runtime;
  const player = game.player;
  for (let i = game.shockwaves.length - 1; i >= 0; i -= 1) {
    const ring = game.shockwaves[i];
    const previousRadius = ring.radius;
    ring.life -= dt;
    const progress = clamp(1 - ring.life / ring.total, 0, 1);
    ring.radius = lerp(0.7, ring.maxRadius, progress);

    if (!ring.visualOnly && !ring.hitPlayer) {
      const dist = Math.hypot(player.x - ring.x, player.z - ring.z);
      if (dist <= ring.radius + 0.55 && dist >= previousRadius - 1.2) {
        ring.hitPlayer = true;
        player.hp -= ring.damage;
        player.flash = Math.max(player.flash, 0.95);
        emitGameEvent(runtime, "player_damaged", {
          wave: game.wave,
          hp: player.hp,
          bossHpRatio: game.boss.maxHp > 0 ? game.boss.hp / game.boss.maxHp : null,
          source: "shockwave",
        });
        addShake(game, 0.55, 0.35);
        pulseScreen(game, 0.16, colors.warning);
        if (game.hurtSoundTimer <= 0) {
          runtime.audio.playSound(game, "hurt");
          game.hurtSoundTimer = 0.28;
        }
      }
    }

    if (ring.life <= 0) {
      game.shockwaves.splice(i, 1);
    }
  }
}

export function updateEffects(game, dt) {
  for (let i = game.particles.length - 1; i >= 0; i -= 1) {
    const particle = game.particles[i];
    particle.life -= dt;
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.z += particle.vz * dt;
    particle.vy -= dt * 4.2;
    particle.vx *= 0.99;
    particle.vz *= 0.99;
    if (particle.life <= 0) {
      game.particles.splice(i, 1);
    }
  }

  for (let i = game.tracers.length - 1; i >= 0; i -= 1) {
    const tracer = game.tracers[i];
    tracer.life -= dt;
    if (tracer.life <= 0) {
      game.tracers.splice(i, 1);
    }
  }
}
