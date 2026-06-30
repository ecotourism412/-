import { ARENA } from "../core/constants.js";

export const pigModel = [
  { x: -0.76, y: 0.45, z: -0.58, w: 1.52, h: 0.9, d: 1.16, color: "pigMetal" },
  { x: -0.68, y: 1.0, z: 0.08, w: 1.36, h: 0.74, d: 0.96, color: "pigBody" },
  { x: -0.36, y: 1.1, z: 0.9, w: 0.72, h: 0.32, d: 0.3, color: "pigSnout" },
  { x: -0.48, y: 1.08, z: 1.06, w: 0.14, h: 0.16, d: 0.12, color: "pigDark" },
  { x: 0.34, y: 1.08, z: 1.06, w: 0.14, h: 0.16, d: 0.12, color: "pigDark" },
  { x: -0.58, y: 1.58, z: 0.32, w: 0.26, h: 0.34, d: 0.26, color: "pigBody" },
  { x: 0.32, y: 1.58, z: 0.32, w: 0.26, h: 0.34, d: 0.26, color: "pigBody" },
  { x: -0.54, y: 1.46, z: 0.92, w: 0.22, h: 0.18, d: 0.08, color: "pigGlow", emissive: true },
  { x: 0.32, y: 1.46, z: 0.92, w: 0.22, h: 0.18, d: 0.08, color: "pigGlow", emissive: true },
  { x: -0.6, y: 0.0, z: -0.34, w: 0.18, h: 0.55, d: 0.18, color: "pigLeg" },
  { x: 0.42, y: 0.0, z: -0.34, w: 0.18, h: 0.55, d: 0.18, color: "pigLeg" },
  { x: -0.6, y: 0.0, z: 0.42, w: 0.18, h: 0.55, d: 0.18, color: "pigLeg" },
  { x: 0.42, y: 0.0, z: 0.42, w: 0.18, h: 0.55, d: 0.18, color: "pigLeg" },
  { x: -0.15, y: 1.55, z: -0.78, w: 0.3, h: 0.26, d: 0.26, color: "pigDark" },
  { x: -0.05, y: 1.78, z: -0.7, w: 0.1, h: 0.26, d: 0.1, color: "pigGlow", emissive: true },
];

export const cabbageSpiritModel = [
  { x: -0.42, y: 0.02, z: -0.42, w: 0.84, h: 0.04, d: 0.84, color: "cabbageShadow" },
  { x: -0.24, y: 0.0, z: -0.12, w: 0.14, h: 0.2, d: 0.16, color: "cabbageStem" },
  { x: 0.1, y: 0.0, z: -0.12, w: 0.14, h: 0.2, d: 0.16, color: "cabbageStem" },
  { x: -0.34, y: 0.14, z: -0.28, w: 0.68, h: 0.82, d: 0.62, color: "cabbageCore" },
  { x: -0.5, y: 0.18, z: -0.36, w: 0.26, h: 0.96, d: 0.62, color: "cabbageLeaf", tag: "leafOuter", yaw: -0.16, sway: 0.8 },
  { x: 0.24, y: 0.18, z: -0.36, w: 0.26, h: 0.96, d: 0.62, color: "cabbageLeaf", tag: "leafOuter", yaw: 0.16, sway: -0.8 },
  { x: -0.42, y: 0.26, z: -0.46, w: 0.84, h: 0.9, d: 0.24, color: "cabbageLeafDark", tag: "leafOuter", sway: 0.45 },
  { x: -0.42, y: 0.82, z: -0.22, w: 0.84, h: 0.38, d: 0.52, color: "cabbageLeafLight", tag: "leafTop", sway: 0.55 },
  { x: -0.24, y: 0.74, z: 0.31, w: 0.13, h: 0.12, d: 0.07, color: "cabbageGlow", emissive: true, tag: "eye" },
  { x: 0.11, y: 0.74, z: 0.31, w: 0.13, h: 0.12, d: 0.07, color: "cabbageGlow", emissive: true, tag: "eye" },
  { x: -0.08, y: 0.54, z: 0.33, w: 0.16, h: 0.06, d: 0.05, color: "cabbageFace", tag: "mouth" },
];

export function createBossModel() {
  const scaled = pigModel.map((box) => ({
    ...box,
    x: box.x * 2.6,
    y: box.y * 2.6,
    z: box.z * 2.6,
    w: box.w * 2.6,
    h: box.h * 2.6,
    d: box.d * 2.6,
  }));

  return [
    ...scaled,
    { x: -1.2, y: 5.0, z: -0.82, w: 2.4, h: 0.34, d: 0.96, color: "crownBase" },
    { x: -1.02, y: 5.32, z: -0.55, w: 0.42, h: 0.48, d: 0.22, color: "crownBase" },
    { x: -0.18, y: 5.32, z: -0.55, w: 0.42, h: 0.68, d: 0.22, color: "crownBase" },
    { x: 0.66, y: 5.32, z: -0.55, w: 0.42, h: 0.48, d: 0.22, color: "crownBase" },
    { x: -1.18, y: 2.22, z: -2.32, w: 2.36, h: 1.62, d: 0.74, color: "bossPack" },
    { x: -0.92, y: 2.48, z: -2.44, w: 0.56, h: 1.02, d: 0.14, color: "bossCore", emissive: true },
    { x: 0.38, y: 2.48, z: -2.44, w: 0.56, h: 1.02, d: 0.14, color: "bossCore", emissive: true },
    { x: -0.36, y: 3.96, z: 2.54, w: 0.72, h: 0.26, d: 0.12, color: "bossCore", emissive: true },
  ];
}

export function createScenery() {
  const boxes = [];
  const segment = 3.6;

  for (let x = -ARENA; x < ARENA; x += 4) {
    boxes.push({
      x,
      y: 0,
      z: -ARENA - 1.2,
      yaw: 0,
      box: { x: 0, y: 0, z: 0, w: segment, h: 2.4, d: 1.2, color: "wall" },
    });
    boxes.push({
      x,
      y: 0,
      z: ARENA,
      yaw: 0,
      box: { x: 0, y: 0, z: 0, w: segment, h: 2.4, d: 1.2, color: "wall" },
    });
  }

  for (let z = -ARENA; z < ARENA; z += 4) {
    boxes.push({
      x: -ARENA - 1.2,
      y: 0,
      z,
      yaw: 0,
      box: { x: 0, y: 0, z: 0, w: 1.2, h: 2.4, d: segment, color: "wall" },
    });
    boxes.push({
      x: ARENA,
      y: 0,
      z,
      yaw: 0,
      box: { x: 0, y: 0, z: 0, w: 1.2, h: 2.4, d: segment, color: "wall" },
    });
  }

  const pylons = [
    [-ARENA + 3, -ARENA + 3],
    [ARENA - 4.8, -ARENA + 3],
    [-ARENA + 3, ARENA - 4.8],
    [ARENA - 4.8, ARENA - 4.8],
    [-6, 6],
    [8, -8],
  ];

  for (const [x, z] of pylons) {
    boxes.push({
      x,
      y: 0,
      z,
      yaw: 0,
      box: { x: 0, y: 0, z: 0, w: 1.6, h: 6, d: 1.6, color: "wall" },
    });
    boxes.push({
      x: x + 0.45,
      y: 2.1,
      z: z + 0.45,
      yaw: 0,
      box: { x: 0, y: 0, z: 0, w: 0.7, h: 2.8, d: 0.7, color: "wallGlow", emissive: true },
    });
  }

  return boxes;
}

export function buildBoxVertices(box) {
  const x0 = box.x;
  const y0 = box.y;
  const z0 = box.z;
  const x1 = box.x + box.w;
  const y1 = box.y + box.h;
  const z1 = box.z + box.d;
  return [
    { x: x0, y: y0, z: z0 },
    { x: x1, y: y0, z: z0 },
    { x: x0, y: y1, z: z0 },
    { x: x1, y: y1, z: z0 },
    { x: x0, y: y0, z: z1 },
    { x: x1, y: y0, z: z1 },
    { x: x0, y: y1, z: z1 },
    { x: x1, y: y1, z: z1 },
  ];
}
