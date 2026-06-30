import { ARENA } from "../core/constants.js";
import { clamp, lerp } from "../core/math3d.js";

export function applyLook(runtime, dt) {
  const { input, game } = runtime;
  const player = game.player;
  player.yaw += input.lookX * 0.0024;
  input.lookX = 0;

  const turnLeft = input.keys.has("q") || input.keys.has("arrowleft");
  const turnRight = input.keys.has("e") || input.keys.has("arrowright");

  if (turnLeft) {
    player.yaw -= dt * 2.05;
  }
  if (turnRight) {
    player.yaw += dt * 2.05;
  }
}

export function movePlayer(runtime, dt) {
  const { input, game } = runtime;
  const player = game.player;
  let localX = 0;
  let localZ = 0;

  if (input.keys.has("w")) {
    localZ += 1;
  }
  if (input.keys.has("s")) {
    localZ -= 1;
  }
  if (input.keys.has("a")) {
    localX -= 1;
  }
  if (input.keys.has("d")) {
    localX += 1;
  }

  localX += input.touch.moveX;
  localZ += -input.touch.moveY;

  const rawMagnitude = Math.hypot(localX, localZ);
  const moveStrength = clamp(rawMagnitude, 0, 1);
  const magnitude = rawMagnitude || 1;
  localX /= magnitude;
  localZ /= magnitude;

  const sprinting =
    input.keys.has("shift") || input.touch.boost || Math.hypot(input.touch.moveX, input.touch.moveY) > 0.92;
  const speed = (sprinting ? 8.8 : 5.8) * moveStrength;
  const sin = Math.sin(player.yaw);
  const cos = Math.cos(player.yaw);
  const worldX = cos * localX + sin * localZ;
  const worldZ = -sin * localX + cos * localZ;

  player.x = clamp(player.x + worldX * speed * dt, -ARENA + 2, ARENA - 2);
  player.z = clamp(player.z + worldZ * speed * dt, -ARENA + 2, ARENA - 2);

  const moving = moveStrength > 0.05;
  const bobTarget = moving ? Math.sin((player.bobPhase += dt * speed * 1.8) * 3.1) * 0.09 : 0;
  player.bob = lerp(player.bob, bobTarget, dt * 10);
}
