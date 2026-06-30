import { FOCAL, HEIGHT, HORIZON, WIDTH } from "../core/constants.js";

export function getCameraY(game) {
  return 1.65 + game.player.bob;
}

export function toCameraSpace(game, world) {
  const dx = world.x - game.player.x;
  const dy = world.y - getCameraY(game);
  const dz = world.z - game.player.z;
  const sin = Math.sin(game.player.yaw);
  const cos = Math.cos(game.player.yaw);
  return {
    x: dx * cos - dz * sin,
    y: dy,
    z: dx * sin + dz * cos,
  };
}

export function projectCameraPoint(point) {
  const scale = FOCAL / point.z;
  return {
    sx: WIDTH * 0.5 + point.x * scale,
    sy: HORIZON - point.y * scale,
    z: point.z,
  };
}

export function projectWorldPoint(game, world) {
  const cameraPoint = toCameraSpace(game, world);
  if (cameraPoint.z <= 0.12) {
    return null;
  }
  return projectCameraPoint(cameraPoint);
}
