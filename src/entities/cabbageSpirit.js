import { ARENA } from "../core/constants.js";
import { clamp, lerpAngle } from "../core/math3d.js";
import { createCabbageSpiritState } from "../core/gameState.js";

const FOLLOW_DELAY_SECONDS = 0.46;
const FOLLOW_DISTANCE = 2.85;
const BOSS_FOLLOW_DISTANCE = 3.25;
const SIDE_OFFSET = -0.82;
const BOSS_SIDE_OFFSET = -1.05;

export function updateCabbageSpirit(runtime, dt) {
  const { game } = runtime;
  if (!game.cabbageSpirit) {
    game.cabbageSpirit = createCabbageSpiritState();
  }

  const cabbage = game.cabbageSpirit;
  const player = game.player;
  const now = game.time;

  updateFollowHistory(cabbage, player, now);
  updateSpeechState(cabbage, game.dialogue, now);
  updateBlink(cabbage, now);
  updateHop(cabbage, game, dt, now);
  moveTowardFollowPoint(cabbage, player, game, dt, now);

  cabbage.speakPulse = Math.max(0, cabbage.speakPulse - dt * 3.8);
  cabbage.squash = Math.max(0, cabbage.squash - dt * 7.5);
  cabbage.bob =
    Math.sin(now * 4.2 + cabbage.phase) * 0.035 +
    cabbage.jump -
    cabbage.squash * 0.035 +
    cabbage.speakPulse * 0.045;

  if (cabbage.expression !== "calm" && now > cabbage.expressionUntil) {
    cabbage.expression = "calm";
  }
}

function updateFollowHistory(cabbage, player, now) {
  cabbage.followLag.push({
    time: now,
    x: player.x,
    z: player.z,
    yaw: player.yaw,
  });
  cabbage.followLag = cabbage.followLag.filter((point) => now - point.time <= 1.6);
}

function moveTowardFollowPoint(cabbage, player, game, dt, now) {
  const sample = sampleFollowHistory(cabbage.followLag, now - FOLLOW_DELAY_SECONDS) ?? player;
  const distance = game.boss.active ? BOSS_FOLLOW_DISTANCE : FOLLOW_DISTANCE;
  const side = game.boss.active ? BOSS_SIDE_OFFSET : SIDE_OFFSET;
  const target = {
    x: sample.x - Math.sin(sample.yaw) * distance + Math.cos(sample.yaw) * side,
    z: sample.z - Math.cos(sample.yaw) * distance - Math.sin(sample.yaw) * side,
  };

  const dx = target.x - cabbage.x;
  const dz = target.z - cabbage.z;
  const dist = Math.hypot(dx, dz);
  if (dist > 0.001) {
    const speed = 4.4 + clamp(dist, 0, 6) * 1.9 + (game.boss.active ? 1.1 : 0);
    const step = Math.min(dist, speed * dt);
    cabbage.x = clamp(cabbage.x + (dx / dist) * step, -ARENA + 1.2, ARENA - 1.2);
    cabbage.z = clamp(cabbage.z + (dz / dist) * step, -ARENA + 1.2, ARENA - 1.2);
  }

  cabbage.yaw = lerpAngle(cabbage.yaw, Math.atan2(player.x - cabbage.x, player.z - cabbage.z), dt * 5.8);
}

function sampleFollowHistory(history, targetTime) {
  if (!history.length) {
    return null;
  }
  let sample = history[0];
  for (const point of history) {
    if (point.time > targetTime) {
      break;
    }
    sample = point;
  }
  return sample;
}

function updateSpeechState(cabbage, dialogue, now) {
  const bark = latestCabbageBark(dialogue);
  if (!bark || bark.id === cabbage.lastBarkId) {
    return;
  }

  cabbage.lastBarkId = bark.id;
  cabbage.expression = expressionForTone(bark.tone);
  cabbage.expressionUntil = now + Math.min(2.4, bark.ttl ?? 2);
  cabbage.speakPulse = 1;
  cabbage.nextHopAt = Math.min(cabbage.nextHopAt, now + 0.16);
}

function latestCabbageBark(dialogue) {
  const barks = dialogue?.barks ?? [];
  for (let i = barks.length - 1; i >= 0; i -= 1) {
    const bark = barks[i];
    if (bark.speaker === "cabbage" || bark.speaker === "cabbageSpirit") {
      return bark;
    }
  }
  return null;
}

function expressionForTone(tone) {
  if (tone === "excited") {
    return "excited";
  }
  if (tone === "nervous" || tone === "threatening") {
    return "nervous";
  }
  if (tone === "hurt" || tone === "angry") {
    return "hurt";
  }
  if (tone === "sad") {
    return "sad";
  }
  return "calm";
}

function updateBlink(cabbage, now) {
  cabbage.blink = now < cabbage.blinkUntil ? 1 : 0;
  if (now >= cabbage.nextBlinkAt) {
    cabbage.blinkUntil = now + 0.11;
    cabbage.nextBlinkAt = now + 2.2 + Math.random() * 3.2;
  }
}

function updateHop(cabbage, game, dt, now) {
  const movingDistance = distanceFromFollowTarget(cabbage, game);
  const wantsHop = now >= cabbage.nextHopAt || movingDistance > 1.4 || cabbage.speakPulse > 0.75;

  if (wantsHop && cabbage.jump <= 0.001) {
    cabbage.jumpVelocity =
      1.25 +
      Math.min(0.55, movingDistance * 0.16) +
      (cabbage.expression === "excited" ? 0.32 : 0) -
      (cabbage.expression === "sad" ? 0.18 : 0);
    cabbage.nextHopAt = now + 2.2 + Math.random() * 3.3;
  }

  if (cabbage.jump > 0 || cabbage.jumpVelocity > 0) {
    cabbage.jump += cabbage.jumpVelocity * dt;
    cabbage.jumpVelocity -= 5.4 * dt;
    if (cabbage.jump <= 0) {
      cabbage.jump = 0;
      cabbage.jumpVelocity = 0;
      cabbage.squash = 1;
    }
  }
}

function distanceFromFollowTarget(cabbage, game) {
  const player = game.player;
  const targetX = player.x - Math.sin(player.yaw) * FOLLOW_DISTANCE + Math.cos(player.yaw) * SIDE_OFFSET;
  const targetZ = player.z - Math.cos(player.yaw) * FOLLOW_DISTANCE - Math.sin(player.yaw) * SIDE_OFFSET;
  return Math.hypot(targetX - cabbage.x, targetZ - cabbage.z);
}
