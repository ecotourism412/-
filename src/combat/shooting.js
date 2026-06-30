import { MAX_SHOT_DISTANCE, colors } from "../core/constants.js";
import { burst, clampEffects } from "../core/effects.js";
import { add3, normalize3, raySphere, scale3 } from "../core/math3d.js";
import { getCameraY } from "../render/projection.js";
import { damagePig } from "../entities/pig.js";
import { damageBoss } from "../entities/boss.js";
import { emitGameEvent } from "../dialogue/dialogueEvents.js";

export function fireShot(runtime) {
  const { game } = runtime;
  const player = game.player;
  player.cooldown = 0.16;
  player.recoil = 1;
  player.muzzle = 1;
  game.shots += 1;
  runtime.audio.playSound(game, "shot");

  const origin = {
    x: player.x + Math.cos(player.yaw) * 0.23 + Math.sin(player.yaw) * 0.34,
    y: getCameraY(game) - 0.12,
    z: player.z - Math.sin(player.yaw) * 0.23 + Math.cos(player.yaw) * 0.34,
  };
  const dir = normalize3({
    x: Math.sin(player.yaw),
    y: -0.08,
    z: Math.cos(player.yaw),
  });

  burst(
    game,
    origin.x + dir.x * 0.45,
    origin.y + dir.y * 0.45,
    origin.z + dir.z * 0.45,
    colors.muzzle,
    6,
    0.45
  );

  let closest = MAX_SHOT_DISTANCE;
  let hit = null;

  if (game.boss.active) {
    const bossHit = getBossHit(game, origin, dir);
    if (bossHit && bossHit.distance < closest) {
      closest = bossHit.distance;
      hit = {
        type: "boss",
        critical: bossHit.critical,
      };
    }
  }

  for (const pig of game.pigs) {
    const pigHit = getPigHit(origin, dir, pig);
    if (pigHit && pigHit.distance < closest) {
      closest = pigHit.distance;
      hit = {
        type: "pig",
        pig,
        critical: pigHit.critical,
      };
    }
  }

  let hitPoint = add3(origin, scale3(dir, closest));
  const floorDistance = origin.y / Math.max(0.001, -dir.y);
  if (!hit && floorDistance > 0 && floorDistance < MAX_SHOT_DISTANCE) {
    hitPoint = add3(origin, scale3(dir, floorDistance));
  }

  if (hit?.type === "pig") {
    hitPoint = add3(origin, scale3(dir, closest));
    if (tryPigDodge(runtime, hit.pig, hitPoint, dir, hit.critical)) {
      // Dodge is a combat event, not an AI decision; AI only chooses the bark.
    } else {
      const damage = hit.critical ? 2 : 1;
      damagePig(runtime, hit.pig, damage, hitPoint, dir, hit.critical);
    }
  } else if (hit?.type === "boss") {
    const damage = hit.critical ? 3 : 2;
    hitPoint = add3(origin, scale3(dir, closest));
    damageBoss(runtime, damage, hitPoint, dir, hit.critical);
  } else {
    burst(game, hitPoint.x, hitPoint.y, hitPoint.z, colors.spark, 5, 0.9);
  }

  game.tracers.push({
    from: origin,
    to: hitPoint,
    life: 0.1,
    total: 0.1,
    critical: Boolean(hit?.critical),
    boss: hit?.type === "boss",
  });
  clampEffects(game);
}

export function getPigHit(origin, dir, pig) {
  const bodyHit = raySphere(origin, dir, { x: pig.x, y: 1.08 + pig.bob, z: pig.z }, 0.95);
  const headHit = raySphere(
    origin,
    dir,
    {
      x: pig.x + Math.sin(pig.yaw) * 0.15,
      y: 1.48 + pig.bob,
      z: pig.z + Math.cos(pig.yaw) * 0.15,
    },
    0.42
  );
  const distance = Math.min(bodyHit ?? Infinity, headHit ?? Infinity);
  if (!Number.isFinite(distance)) {
    return null;
  }
  return {
    distance,
    critical: headHit !== null && (bodyHit === null || headHit <= bodyHit),
  };
}

export function getBossHit(game, origin, dir) {
  const boss = game.boss;
  const bodyHit = raySphere(origin, dir, { x: boss.x, y: 2.45 + boss.bob, z: boss.z }, 2.45);
  const headHit = raySphere(
    origin,
    dir,
    {
      x: boss.x + Math.sin(boss.yaw) * 0.5,
      y: 4.15 + boss.bob,
      z: boss.z + Math.cos(boss.yaw) * 0.5,
    },
    1.15
  );
  const coreHit = raySphere(
    origin,
    dir,
    {
      x: boss.x + Math.sin(boss.yaw) * 1.12,
      y: 4.02 + boss.bob,
      z: boss.z + Math.cos(boss.yaw) * 1.12,
    },
    0.52
  );
  const distance = Math.min(bodyHit ?? Infinity, headHit ?? Infinity, coreHit ?? Infinity);
  if (!Number.isFinite(distance)) {
    return null;
  }
  return {
    distance,
    critical:
      coreHit !== null && coreHit <= distance + 0.0001
        ? true
        : headHit !== null && (bodyHit === null || headHit <= bodyHit),
  };
}

function tryPigDodge(runtime, pig, hitPoint, dir, critical) {
  const { game } = runtime;
  if (pig.dead || game.time - pig.lastDodgeAt < 1.2) {
    return false;
  }

  const chance = pig.dodgeChance * (critical ? 0.65 : 1);
  if (Math.random() >= chance) {
    return false;
  }

  const side = Math.random() < 0.5 ? -1 : 1;
  pig.lastDodgeAt = game.time;
  pig.hurt = 0.45;
  pig.vx += dir.z * side * 4.6;
  pig.vz += -dir.x * side * 4.6;
  burst(game, hitPoint.x, hitPoint.y, hitPoint.z, colors.spark, 8, 1.1);
  runtime.audio.playSound(game, "hit");
  emitGameEvent(runtime, "pig_dodged", {
    wave: game.wave,
    pigId: pig.id,
    personality: pig.personality,
    critical,
  });
  return true;
}
