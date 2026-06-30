import {
  ARENA,
  FLOOR_RANGE,
  FOCAL,
  HEIGHT,
  HORIZON,
  TAU,
  WIDTH,
  colors,
} from "../core/constants.js";
import {
  average3,
  cross3,
  dot3,
  mixColor,
  normalize3,
  rgb,
  rotateY,
  shadeColor,
  sub3,
  clamp,
} from "../core/math3d.js";
import { drawDialogue } from "../dialogue/renderDialogue.js";
import { cabbageSpiritModel, pigModel, buildBoxVertices, createBossModel, createScenery } from "./models.js";
import { projectCameraPoint, projectWorldPoint, toCameraSpace } from "./projection.js";

const lightDir = normalize3({ x: -0.42, y: 0.88, z: -0.18 });

export function createRenderAssets() {
  return {
    bossModel: createBossModel(),
    scenery: createScenery(),
    stars: Array.from({ length: 84 }, () => {
      const angle = Math.random() * TAU;
      const height = 0.16 + Math.random() * 0.5;
      return {
        x: Math.cos(angle),
        y: height,
        z: Math.sin(angle),
        size: 0.6 + Math.random() * 1.5,
        twinkle: Math.random() * TAU,
      };
    }),
  };
}

export function render(runtime) {
  const { canvasContext: ctx, game } = runtime;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, WIDTH, HEIGHT);
  ctx.save();
  ctx.translate(game.screenShake.x, game.screenShake.y);

  drawSky(runtime);

  const faces = [];
  addFloor(runtime, faces);
  addScenery(runtime, faces);
  addCabbageSpirit(runtime, faces);

  for (const pig of game.pigs) {
    addPig(runtime, faces, pig);
  }

  if (game.boss.active) {
    addBoss(runtime, faces, game.boss);
  }

  faces.sort((a, b) => b.depth - a.depth);
  drawFaces(ctx, faces);
  drawShockwaves(runtime);
  drawTracers(runtime);
  drawParticles(runtime);
  drawCrosshair(runtime);
  drawWeapon(runtime);
  drawHud(runtime);
  drawDialogue(runtime);
  drawScreenFx(runtime);

  ctx.restore();
}

function drawSky(runtime) {
  const { canvasContext: ctx, game } = runtime;
  const sky = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  sky.addColorStop(0, "rgb(54 12 72)");
  sky.addColorStop(0.5, "rgb(34 7 43)");
  sky.addColorStop(1, "rgb(12 2 16)");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  const glow = ctx.createRadialGradient(WIDTH * 0.54, 70, 8, WIDTH * 0.54, 70, 92);
  glow.addColorStop(0, "rgba(255, 137, 221, 0.48)");
  glow.addColorStop(1, "rgba(255, 137, 221, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  if (game.boss.active) {
    const pulse = 0.16 + Math.sin(game.time * 5) * 0.06;
    ctx.fillStyle = `rgba(255, 92, 178, ${pulse})`;
    ctx.fillRect(0, 0, WIDTH, 72);
  }

  drawMoon(runtime);
  drawStars(runtime);

  const band = ctx.createLinearGradient(0, 80, 0, HEIGHT);
  band.addColorStop(0, "rgba(255, 95, 197, 0)");
  band.addColorStop(1, "rgba(255, 54, 170, 0.09)");
  ctx.fillStyle = band;
  ctx.fillRect(0, 60, WIDTH, HEIGHT - 60);
}

function drawMoon(runtime) {
  const { canvasContext: ctx, game } = runtime;
  const moon = projectWorldPoint(game, { x: 24, y: 13, z: 72 });
  if (!moon) {
    return;
  }

  const radius = clamp((34 / moon.z) * 6, 12, 28);
  ctx.globalAlpha = 0.75;
  ctx.fillStyle = "rgba(255, 115, 211, 0.9)";
  ctx.beginPath();
  ctx.arc(moon.sx, moon.sy, radius, 0, TAU);
  ctx.fill();
  ctx.globalAlpha = 1;

  ctx.strokeStyle = "rgba(134, 247, 255, 0.8)";
  ctx.lineWidth = 1;
  for (let i = -2; i <= 2; i += 1) {
    ctx.beginPath();
    ctx.moveTo(moon.sx - radius, moon.sy + i * 5);
    ctx.lineTo(moon.sx + radius, moon.sy + i * 5);
    ctx.stroke();
  }
}

function drawStars(runtime) {
  const { canvasContext: ctx, game, renderAssets } = runtime;
  const sin = Math.sin(game.player.yaw);
  const cos = Math.cos(game.player.yaw);
  for (const star of renderAssets.stars) {
    const x = star.x * cos - star.z * sin;
    const z = star.x * sin + star.z * cos;
    if (z <= -0.2) {
      continue;
    }
    const sx = WIDTH * 0.5 + (x / (z + 1.4)) * 170;
    const sy = 76 - (star.y / (z + 1.35)) * 112;
    if (sx < 0 || sx >= WIDTH || sy < 0 || sy >= HEIGHT * 0.55) {
      continue;
    }
    const pulse = 0.58 + Math.sin(game.time * 3 + star.twinkle) * 0.22;
    const size = z > 0.4 ? star.size : star.size * 0.8;
    ctx.fillStyle = `rgba(255, 250, 255, ${pulse})`;
    ctx.fillRect(Math.round(sx), Math.round(sy), Math.max(1, size), Math.max(1, size));
  }
}

function addFloor(runtime, faces) {
  const { game } = runtime;
  const px = Math.floor(game.player.x);
  const pz = Math.floor(game.player.z);

  for (let x = px - FLOOR_RANGE; x <= px + FLOOR_RANGE; x += 1) {
    for (let z = pz - FLOOR_RANGE; z <= pz + FLOOR_RANGE; z += 1) {
      if (x < -ARENA || x >= ARENA || z < -ARENA || z >= ARENA) {
        continue;
      }

      const cx = x + 0.5;
      const cz = z + 0.5;
      const dist = Math.hypot(cx - game.player.x, cz - game.player.z);
      if (dist > FLOOR_RANGE + 2) {
        continue;
      }

      let base = (x + z) % 2 === 0 ? colors.floorA : colors.floorB;
      if (x % 5 === 0 || z % 5 === 0) {
        base = game.boss.active ? colors.laneBoss : colors.lane;
      }

      pushQuad(
        game,
        faces,
        [
          { x, y: 0, z },
          { x, y: 0, z: z + 1 },
          { x: x + 1, y: 0, z: z + 1 },
          { x: x + 1, y: 0, z },
        ],
        base,
        { stroke: shadeColor(base, 1.26), alpha: 1 }
      );
    }
  }
}

function addScenery(runtime, faces) {
  for (const box of runtime.renderAssets.scenery) {
    addBox(runtime.game, faces, box, {});
  }
}

function addCabbageSpirit(runtime, faces) {
  const { game } = runtime;
  const cabbage = game.cabbageSpirit;
  if (!cabbage) {
    return;
  }

  const nervousWiggle = cabbage.expression === "nervous" ? Math.sin(game.time * 20 + cabbage.phase) * 0.035 : 0;
  const hurtLean = cabbage.expression === "hurt" ? -0.05 : 0;
  const sadDrop = cabbage.expression === "sad" ? -0.04 : 0;
  const excitedGlow = cabbage.expression === "excited" ? 0.13 + Math.sin(game.time * 16) * 0.05 : 0;
  const leafSway =
    Math.sin(game.time * 5.4 + cabbage.phase) * 0.07 +
    cabbage.speakPulse * 0.08 +
    (cabbage.expression === "nervous" ? Math.sin(game.time * 18) * 0.05 : 0);

  addModel(
    game,
    faces,
    cabbageSpiritModel,
    {
      x: cabbage.x,
      y: 0.06 + cabbage.bob + sadDrop,
      z: cabbage.z,
      yaw: cabbage.yaw + nervousWiggle + hurtLean,
    },
    {
      phase: cabbage.phase,
      accentMix: clamp(cabbage.speakPulse * 0.24 + excitedGlow, 0, 0.34),
      accentColor: colors.cabbageGlow,
      leafSway,
      skipBox: (box) => box.tag === "eye" && cabbage.blink > 0,
    }
  );
}

function addPig(runtime, faces, pig) {
  const accentMix = pig.guard ? 0.12 : 0;
  addModel(
    runtime.game,
    faces,
    pigModel,
    {
      x: pig.x,
      y: 0.12 + pig.bob,
      z: pig.z,
      yaw: pig.yaw + pig.wiggle,
    },
    {
      hurtTint: pig.hurt * 0.42,
      phase: pig.phase,
      accentMix,
      accentColor: colors.guardGlow,
    }
  );
}

function addBoss(runtime, faces, boss) {
  const warningPulse =
    boss.state === "telegraphCharge" || boss.state === "telegraphStomp"
      ? 0.22 + Math.sin(runtime.game.time * 24) * 0.18
      : boss.state === "charge"
        ? 0.18
        : 0;

  addModel(
    runtime.game,
    faces,
    runtime.renderAssets.bossModel,
    {
      x: boss.x,
      y: 0.12 + boss.bob,
      z: boss.z,
      yaw: boss.yaw + boss.wiggle,
    },
    {
      hurtTint: boss.hurt * 0.45,
      phase: boss.phase,
      accentMix: Math.max(0, warningPulse),
      accentColor: colors.warning,
    }
  );
}

function addModel(game, faces, model, entity, options = {}) {
  for (const box of model) {
    if (options.skipBox?.(box)) {
      continue;
    }
    const boxYaw = (box.yaw ?? 0) + (box.sway ?? 0) * (options.leafSway ?? 0);
    addBox(
      game,
      faces,
      {
        x: entity.x,
        y: entity.y,
        z: entity.z,
        yaw: entity.yaw + boxYaw,
        box,
      },
      options
    );
  }
}

function addBox(game, faces, item, options = {}) {
  const box = item.box ?? item;
  const yaw = item.yaw ?? 0;
  const worldVertices = buildBoxVertices(box).map((vertex) => {
    const rotated = rotateY(vertex, yaw);
    return {
      x: rotated.x + (item.x ?? 0),
      y: vertex.y + (item.y ?? 0),
      z: rotated.z + (item.z ?? 0),
    };
  });

  const faceIndices = [
    [0, 2, 3, 1],
    [4, 5, 7, 6],
    [0, 4, 6, 2],
    [1, 3, 7, 5],
    [2, 6, 7, 3],
    [0, 1, 5, 4],
  ];

  for (const indices of faceIndices) {
    const vertices = indices.map((index) => worldVertices[index]);
    let baseColor = colors[box.color];
    if (box.emissive) {
      const pulse = 1.08 + Math.sin(game.time * 9 + (options.phase ?? 0)) * 0.16;
      baseColor = shadeColor(baseColor, pulse);
    }
    if (options.hurtTint > 0) {
      baseColor = mixColor(baseColor, colors.white, options.hurtTint);
    }
    if (options.accentMix > 0) {
      baseColor = mixColor(baseColor, options.accentColor ?? colors.warning, options.accentMix);
    }
    pushQuad(game, faces, vertices, baseColor, {
      stroke: box.emissive ? shadeColor(baseColor, 0.72) : shadeColor(baseColor, 0.58),
    });
  }
}

function pushQuad(game, faces, worldVertices, color, options = {}) {
  const cameraVertices = worldVertices.map((vertex) => toCameraSpace(game, vertex));
  if (cameraVertices.some((vertex) => vertex.z <= 0.12)) {
    return;
  }

  const normal = cross3(sub3(cameraVertices[1], cameraVertices[0]), sub3(cameraVertices[2], cameraVertices[0]));
  const centroid = average3(cameraVertices);
  if (dot3(normal, centroid) >= 0) {
    return;
  }

  const worldNormal = normalize3(
    cross3(sub3(worldVertices[1], worldVertices[0]), sub3(worldVertices[2], worldVertices[0]))
  );
  const lit = clamp(0.54 + Math.max(0, dot3(worldNormal, lightDir)) * 0.34, 0.4, 1.18);
  const depth = centroid.z;
  const fade = clamp(1.16 - depth * 0.012, 0.42, 1);
  const fill = shadeColor(color, lit * fade);
  const stroke = options.stroke ? shadeColor(options.stroke, fade) : shadeColor(fill, 0.6);
  const points = cameraVertices.map(projectCameraPoint);

  faces.push({
    depth,
    fill,
    stroke,
    points,
    alpha: options.alpha ?? 1,
  });
}

function drawFaces(ctx, faces) {
  for (const face of faces) {
    ctx.globalAlpha = face.alpha;
    ctx.beginPath();
    ctx.moveTo(Math.round(face.points[0].sx), Math.round(face.points[0].sy));
    for (let i = 1; i < face.points.length; i += 1) {
      ctx.lineTo(Math.round(face.points[i].sx), Math.round(face.points[i].sy));
    }
    ctx.closePath();
    ctx.fillStyle = rgb(face.fill);
    ctx.fill();
    ctx.strokeStyle = rgb(face.stroke);
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function drawShockwaves(runtime) {
  const { canvasContext: ctx, game } = runtime;
  for (const ring of game.shockwaves) {
    const points = [];
    const alpha = clamp(ring.life / ring.total, 0, 1);
    for (let i = 0; i <= 28; i += 1) {
      const angle = (TAU * i) / 28;
      const point = projectWorldPoint(game, {
        x: ring.x + Math.cos(angle) * ring.radius,
        y: 0.08,
        z: ring.z + Math.sin(angle) * ring.radius,
      });
      if (point) {
        points.push(point);
      }
    }
    if (points.length < 6) {
      continue;
    }

    ctx.strokeStyle = ring.visualOnly
      ? `rgba(145, 246, 255, ${alpha * 0.55})`
      : `rgba(255, 110, 182, ${alpha * 0.8})`;
    ctx.lineWidth = ring.visualOnly ? 1.5 : 2;
    ctx.beginPath();
    ctx.moveTo(points[0].sx, points[0].sy);
    for (let i = 1; i < points.length; i += 1) {
      ctx.lineTo(points[i].sx, points[i].sy);
    }
    ctx.stroke();

    for (let i = 0; i < points.length; i += 3) {
      ctx.fillStyle = ring.visualOnly
        ? `rgba(145, 246, 255, ${alpha * 0.4})`
        : `rgba(255, 208, 104, ${alpha * 0.5})`;
      ctx.fillRect(Math.round(points[i].sx), Math.round(points[i].sy), 2, 2);
    }
  }
}

function drawTracers(runtime) {
  const { canvasContext: ctx, game } = runtime;
  for (const tracer of game.tracers) {
    const from = projectWorldPoint(game, tracer.from);
    const to = projectWorldPoint(game, tracer.to);
    if (!from || !to) {
      continue;
    }
    const alpha = tracer.life / tracer.total;
    ctx.strokeStyle = tracer.boss
      ? `rgba(255, 141, 218, ${alpha})`
      : tracer.critical
        ? `rgba(145, 246, 255, ${alpha})`
        : `rgba(255, 241, 206, ${alpha})`;
    ctx.lineWidth = tracer.boss ? 2 : tracer.critical ? 2 : 1.5;
    ctx.beginPath();
    ctx.moveTo(from.sx, from.sy);
    ctx.lineTo(to.sx, to.sy);
    ctx.stroke();
  }
}

function drawParticles(runtime) {
  const { canvasContext: ctx, game } = runtime;
  for (const particle of game.particles) {
    const projected = projectWorldPoint(game, particle);
    if (!projected) {
      continue;
    }
    const size = clamp((particle.size * FOCAL) / projected.z, 1, 6);
    const alpha = clamp(particle.life / particle.total, 0, 1);
    ctx.fillStyle = `rgba(${particle.color[0]}, ${particle.color[1]}, ${particle.color[2]}, ${alpha})`;
    ctx.fillRect(
      Math.round(projected.sx - size / 2),
      Math.round(projected.sy - size / 2),
      Math.round(size),
      Math.round(size)
    );
  }
}

function drawCrosshair(runtime) {
  const { canvasContext: ctx, game } = runtime;
  const warningPulse =
    game.boss.active && (game.boss.state === "telegraphCharge" || game.boss.state === "telegraphStomp")
      ? 0.3 + Math.sin(game.time * 18) * 0.18
      : 0;
  const pulse = 0.7 + game.player.muzzle * 0.4 + game.player.flash * 0.2 + warningPulse;
  ctx.strokeStyle = game.boss.active ? `rgba(255, 206, 114, ${pulse})` : `rgba(145, 246, 255, ${pulse})`;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(WIDTH / 2 - 9, HEIGHT / 2);
  ctx.lineTo(WIDTH / 2 - 2, HEIGHT / 2);
  ctx.moveTo(WIDTH / 2 + 2, HEIGHT / 2);
  ctx.lineTo(WIDTH / 2 + 9, HEIGHT / 2);
  ctx.moveTo(WIDTH / 2, HEIGHT / 2 - 9);
  ctx.lineTo(WIDTH / 2, HEIGHT / 2 - 2);
  ctx.moveTo(WIDTH / 2, HEIGHT / 2 + 2);
  ctx.lineTo(WIDTH / 2, HEIGHT / 2 + 9);
  ctx.stroke();
  ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
  ctx.fillRect(WIDTH / 2, HEIGHT / 2, 1, 1);
}

function drawWeapon(runtime) {
  const { canvasContext: ctx, game } = runtime;
  const recoil = game.player.recoil;
  const muzzle = game.player.muzzle;
  const swayX = Math.sin(game.player.bobPhase * 4) * 2;
  const swayY = Math.abs(Math.cos(game.player.bobPhase * 4)) * 2;
  const baseX = 260 + swayX + recoil * 5;
  const baseY = 165 + swayY + recoil * 2;

  const body = [
    [0, 10, 58, 22, colors.pigDark],
    [18, 0, 68, 16, colors.pigMetal],
    [43, 4, 30, 12, colors.pigBody],
    [68, 6, 36, 8, colors.spark],
    [8, 26, 20, 17, colors.pigDark],
    [20, 26, 18, 14, colors.pigMetal],
    [48, 18, 26, 10, colors.pigSnout],
  ];

  for (const [x, y, w, h, color] of body) {
    ctx.fillStyle = rgb(color);
    ctx.fillRect(Math.round(baseX + x), Math.round(baseY + y), w, h);
    ctx.strokeStyle = rgb(shadeColor(color, 0.5));
    ctx.strokeRect(Math.round(baseX + x), Math.round(baseY + y), w, h);
  }

  if (muzzle > 0.02) {
    ctx.fillStyle = `rgba(255, 238, 198, ${0.4 + muzzle * 0.5})`;
    ctx.fillRect(baseX + 100, baseY + 7, 18 + muzzle * 5, 8);
    ctx.fillStyle = `rgba(145, 246, 255, ${0.3 + muzzle * 0.45})`;
    ctx.fillRect(baseX + 108, baseY + 8, 11 + muzzle * 4, 6);
  }
}

function drawHud(runtime) {
  const { canvasContext: ctx, game, input } = runtime;
  const hpRatio = game.player.hp / game.player.maxHp;

  ctx.fillStyle = "rgba(15, 4, 20, 0.7)";
  ctx.fillRect(10, 10, 118, 14);
  ctx.fillStyle = "rgba(255, 118, 214, 0.9)";
  ctx.fillRect(11, 11, Math.max(0, 116 * hpRatio), 12);
  ctx.strokeStyle = "rgba(255, 201, 239, 0.9)";
  ctx.strokeRect(10.5, 10.5, 118, 14);

  ctx.font = 'bold 10px "Courier New", monospace';
  ctx.fillStyle = "rgba(25, 2, 28, 0.95)";
  ctx.fillText(`HP ${Math.ceil(game.player.hp)}`, 16, 21);

  ctx.font = 'bold 11px "Courier New", monospace';
  ctx.fillStyle = "rgba(145, 246, 255, 0.95)";
  ctx.fillText(`WAVE ${String(game.wave).padStart(2, "0")}`, WIDTH - 92, 20);

  ctx.fillStyle = game.encounterType === "boss" ? "rgba(255, 206, 114, 0.95)" : "rgba(255, 189, 235, 0.95)";
  ctx.fillText(`PIGS ${String(game.pigs.length).padStart(2, "0")}`, WIDTH - 92, 34);

  ctx.fillStyle = "rgba(255, 255, 255, 0.92)";
  ctx.fillText(`SCORE ${game.score}`, 12, HEIGHT - 16);

  ctx.fillStyle = "rgba(255, 212, 239, 0.78)";
  ctx.font = '10px "Courier New", monospace';
  ctx.fillText(
    game.pausedForOrientation
      ? "请横屏游玩  |  旋转手机后自动恢复"
      : input.touch.enabled
        ? "左摇杆移动  |  右侧拖动转向  |  FIRE / BOOST"
        : "WASD move  |  Mouse/QE turn  |  Click/Space shoot",
    12,
    HEIGHT - 6
  );

  if (game.boss.active) {
    const ratio = clamp(game.boss.hp / game.boss.maxHp, 0, 1);
    const barWidth = 168;
    const barX = WIDTH * 0.5 - barWidth * 0.5;
    const barY = 10;
    ctx.fillStyle = "rgba(18, 4, 24, 0.82)";
    ctx.fillRect(barX, barY, barWidth, 14);
    ctx.fillStyle = "rgba(255, 108, 187, 0.95)";
    ctx.fillRect(barX + 1, barY + 1, (barWidth - 2) * ratio, 12);
    ctx.strokeStyle = "rgba(255, 206, 114, 0.95)";
    ctx.strokeRect(barX + 0.5, barY + 0.5, barWidth, 14);
    ctx.font = 'bold 10px "Courier New", monospace';
    ctx.fillStyle = "rgba(255, 236, 246, 0.95)";
    ctx.fillText("猪王 MK-III", barX + 46, barY - 3);
  }
}

function drawScreenFx(runtime) {
  const { canvasContext: ctx, game } = runtime;
  for (let y = 0; y < HEIGHT; y += 3) {
    ctx.fillStyle = "rgba(0, 0, 0, 0.04)";
    ctx.fillRect(0, y, WIDTH, 1);
  }

  if (game.boss.active) {
    const pulse =
      game.boss.state === "telegraphCharge" || game.boss.state === "telegraphStomp"
        ? 0.12 + Math.sin(game.time * 16) * 0.05
        : 0.06;
    ctx.fillStyle = `rgba(255, 95, 172, ${pulse})`;
    ctx.fillRect(0, 0, 18, HEIGHT);
    ctx.fillRect(WIDTH - 18, 0, 18, HEIGHT);
  }

  if (game.screenPulse > 0) {
    const color = game.screenPulseColor;
    ctx.fillStyle = `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${game.screenPulse * 0.22})`;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
  }

  if (game.player.flash > 0) {
    ctx.fillStyle = `rgba(255, 133, 210, ${game.player.flash * 0.12})`;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
  }

  const vignette = ctx.createRadialGradient(WIDTH / 2, HEIGHT / 2, 55, WIDTH / 2, HEIGHT / 2, 260);
  vignette.addColorStop(0, "rgba(0, 0, 0, 0)");
  vignette.addColorStop(1, "rgba(0, 0, 0, 0.3)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
}
