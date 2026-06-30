import { ARENA, TAU, colors } from "../core/constants.js";
import { burst } from "../core/effects.js";
import { clamp, lerp } from "../core/math3d.js";
import { pickPigPersonality } from "../ai/personalities.js";
import { emitGameEvent } from "../dialogue/dialogueEvents.js";

export function createPig(game, x, z, wave, guard) {
  const personality = pickPigPersonality(wave, guard);
  return {
    id: game.nextPigId++,
    x,
    z,
    vx: 0,
    vz: 0,
    yaw: 0,
    hp: guard ? 2 + Math.floor((wave - 2) / 3) : 2 + Math.floor((wave - 1) / 4),
    speed: (guard ? 2.05 : 1.82) + wave * 0.08 + Math.random() * 0.22,
    damagePerSec: (guard ? 8.8 : 7.6) + wave * 0.68,
    bob: 0,
    wiggle: 0,
    phase: Math.random() * TAU,
    hurt: 0,
    dead: false,
    guard,
    personality: personality.id,
    dodgeChance: guard ? Math.max(0.06, personality.dodgeChance - 0.05) : personality.dodgeChance,
    lastBarkAt: -999,
    lastDodgeAt: -999,
  };
}

export function updatePigs(runtime, dt) {
  const { game } = runtime;
  const player = game.player;
  let playerDamaged = false;

  for (let i = 0; i < game.pigs.length; i += 1) {
    const pig = game.pigs[i];
    if (pig.dead) {
      continue;
    }

    pig.hurt = Math.max(0, pig.hurt - dt * 4.2);
    pig.bob = Math.sin(game.time * 7 + pig.phase) * 0.08;
    pig.wiggle = Math.sin(game.time * 12 + pig.phase) * 0.05;

    const toPlayerX = player.x - pig.x;
    const toPlayerZ = player.z - pig.z;
    const dist = Math.hypot(toPlayerX, toPlayerZ) || 0.0001;
    const dirX = toPlayerX / dist;
    const dirZ = toPlayerZ / dist;

    let moveX = dirX + -dirZ * 0.32 * Math.sin(game.time + pig.phase);
    let moveZ = dirZ + dirX * 0.32 * Math.sin(game.time + pig.phase);

    let sepX = 0;
    let sepZ = 0;
    for (let j = 0; j < game.pigs.length; j += 1) {
      if (i === j || game.pigs[j].dead) {
        continue;
      }
      const other = game.pigs[j];
      const dx = pig.x - other.x;
      const dz = pig.z - other.z;
      const separation = Math.hypot(dx, dz);
      if (separation > 0 && separation < 1.85) {
        const push = (1.85 - separation) / 1.85;
        sepX += (dx / separation) * push;
        sepZ += (dz / separation) * push;
      }
    }

    if (game.boss.active) {
      const dx = pig.x - game.boss.x;
      const dz = pig.z - game.boss.z;
      const separation = Math.hypot(dx, dz);
      if (separation > 0 && separation < 3.6) {
        const push = (3.6 - separation) / 3.6;
        sepX += (dx / separation) * push * 1.4;
        sepZ += (dz / separation) * push * 1.4;
      }
    }

    if (dist < 1.55) {
      moveX -= dirX * 1.8;
      moveZ -= dirZ * 1.8;
      player.hp -= pig.damagePerSec * dt;
      player.flash = Math.max(player.flash, 0.45);
      playerDamaged = true;
      emitGameEvent(runtime, "player_damaged", {
        wave: game.wave,
        hp: player.hp,
        pigId: pig.id,
        personality: pig.personality,
        source: "pig_contact",
      });
    }

    const steerX = moveX + sepX * 1.45;
    const steerZ = moveZ + sepZ * 1.45;
    const steerLength = Math.hypot(steerX, steerZ) || 1;
    pig.vx = lerp(pig.vx, (steerX / steerLength) * pig.speed, dt * 3.6);
    pig.vz = lerp(pig.vz, (steerZ / steerLength) * pig.speed, dt * 3.6);

    pig.x = clamp(pig.x + pig.vx * dt, -ARENA + 1.5, ARENA - 1.5);
    pig.z = clamp(pig.z + pig.vz * dt, -ARENA + 1.5, ARENA - 1.5);
    pig.yaw = Math.atan2(player.x - pig.x, player.z - pig.z);
  }

  if (playerDamaged && game.hurtSoundTimer <= 0) {
    runtime.audio.playSound(game, "hurt");
    game.hurtSoundTimer = 0.28;
  }

  game.pigs = game.pigs.filter((pig) => !pig.dead);
}

export function damagePig(runtime, pig, damage, hitPoint, dir, critical) {
  const { game } = runtime;
  pig.hp -= damage;
  pig.hurt = 1;
  pig.vx += dir.x * 1.5;
  pig.vz += dir.z * 1.5;
  burst(game, hitPoint.x, hitPoint.y, hitPoint.z, critical ? colors.spark : colors.hit, critical ? 12 : 8, 1.5);
  runtime.audio.playSound(game, critical ? "crit" : "hit");

  emitGameEvent(runtime, "pig_hit", {
    wave: game.wave,
    pigId: pig.id,
    personality: pig.personality,
    critical,
  });

  if (pig.hp <= 0) {
    pig.dead = true;
    game.score += 140 + game.wave * 18 + (pig.guard ? 30 : 0);
    game.kills += 1;
    burst(game, pig.x, 1.1 + pig.bob, pig.z, colors.pigBody, 20, 2.2);
    burst(game, pig.x, 1.3 + pig.bob, pig.z, colors.spark, 12, 2.5);
    runtime.audio.playSound(game, "explode");
    emitGameEvent(runtime, "pig_killed", {
      wave: game.wave,
      pigId: pig.id,
      personality: pig.personality,
      score: game.score,
    });
  }
}
