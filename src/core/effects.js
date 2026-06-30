import { MAX_PARTICLES, MAX_SHOCKWAVES, MAX_TRACERS, TAU } from "./constants.js";

export function burst(game, x, y, z, color, count, force) {
  for (let i = 0; i < count; i += 1) {
    const angle = Math.random() * TAU;
    const lift = Math.random() * 1.6;
    const speed = 0.7 + Math.random() * force;
    game.particles.push({
      x,
      y,
      z,
      vx: Math.cos(angle) * speed,
      vy: lift * 1.6,
      vz: Math.sin(angle) * speed,
      color,
      size: 0.05 + Math.random() * 0.12,
      life: 0.18 + Math.random() * 0.42,
      total: 0.6,
    });
  }
  clampEffects(game);
}

export function addShake(game, strength, duration) {
  game.screenShake.time = Math.max(game.screenShake.time, duration);
  game.screenShake.strength = Math.max(game.screenShake.strength, strength);
}

export function pulseScreen(game, amount, color) {
  game.screenPulse = Math.max(game.screenPulse, amount);
  game.screenPulseColor = color;
}

export function clampEffects(game) {
  if (game.particles.length > MAX_PARTICLES) {
    game.particles.splice(0, game.particles.length - MAX_PARTICLES);
  }
  if (game.tracers.length > MAX_TRACERS) {
    game.tracers.splice(0, game.tracers.length - MAX_TRACERS);
  }
  if (game.shockwaves.length > MAX_SHOCKWAVES) {
    game.shockwaves.splice(0, game.shockwaves.length - MAX_SHOCKWAVES);
  }
}
