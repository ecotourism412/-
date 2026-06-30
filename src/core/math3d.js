import { MAX_SHOT_DISTANCE } from "./constants.js";

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function lerpAngle(a, b, t) {
  const diff = Math.atan2(Math.sin(b - a), Math.cos(b - a));
  return a + diff * t;
}

export function normalize3(vector) {
  const length = Math.hypot(vector.x, vector.y, vector.z) || 1;
  return {
    x: vector.x / length,
    y: vector.y / length,
    z: vector.z / length,
  };
}

export function dot3(a, b) {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

export function cross3(a, b) {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

export function sub3(a, b) {
  return {
    x: a.x - b.x,
    y: a.y - b.y,
    z: a.z - b.z,
  };
}

export function add3(a, b) {
  return {
    x: a.x + b.x,
    y: a.y + b.y,
    z: a.z + b.z,
  };
}

export function scale3(vector, scale) {
  return {
    x: vector.x * scale,
    y: vector.y * scale,
    z: vector.z * scale,
  };
}

export function average3(points) {
  const total = points.reduce(
    (acc, point) => {
      acc.x += point.x;
      acc.y += point.y;
      acc.z += point.z;
      return acc;
    },
    { x: 0, y: 0, z: 0 }
  );
  return {
    x: total.x / points.length,
    y: total.y / points.length,
    z: total.z / points.length,
  };
}

export function rotateY(point, yaw) {
  const sin = Math.sin(yaw);
  const cos = Math.cos(yaw);
  return {
    x: point.x * cos + point.z * sin,
    z: -point.x * sin + point.z * cos,
  };
}

export function raySphere(origin, dir, center, radius) {
  const offset = sub3(origin, center);
  const b = dot3(offset, dir);
  const c = dot3(offset, offset) - radius * radius;
  const h = b * b - c;
  if (h < 0) {
    return null;
  }
  const t = -b - Math.sqrt(h);
  if (t < 0 || t > MAX_SHOT_DISTANCE) {
    return null;
  }
  return t;
}

export function rgb(color) {
  return `rgb(${Math.round(color[0])} ${Math.round(color[1])} ${Math.round(color[2])})`;
}

export function shadeColor(color, factor) {
  return [
    clamp(color[0] * factor, 0, 255),
    clamp(color[1] * factor, 0, 255),
    clamp(color[2] * factor, 0, 255),
  ];
}

export function mixColor(a, b, amount) {
  return [
    lerp(a[0], b[0], amount),
    lerp(a[1], b[1], amount),
    lerp(a[2], b[2], amount),
  ];
}
