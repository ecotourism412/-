import { FOCAL, HEIGHT, WIDTH } from "../core/constants.js";
import { clamp } from "../core/math3d.js";
import { projectWorldPoint } from "../render/projection.js";

const speakerColors = {
  boss: "rgba(255, 206, 114, 0.96)",
  pigKing: "rgba(255, 206, 114, 0.96)",
  cabbageSpirit: "rgba(145, 246, 255, 0.96)",
  cabbage: "rgba(145, 246, 255, 0.96)",
  pig: "rgba(255, 170, 230, 0.96)",
  system: "rgba(255, 255, 255, 0.9)",
};

export function drawDialogue(runtime) {
  const { canvasContext: ctx, game } = runtime;
  const barks = game.dialogue.barks;
  if (!barks.length) {
    return;
  }

  drawCabbageBubble(runtime, latestCabbageBark(barks));
  drawHudDialogue(ctx, barks.filter((bark) => !isCabbageSpeaker(bark.speaker)));
}

function drawHudDialogue(ctx, barks) {
  if (!barks.length) {
    return;
  }

  const visible = barks.slice(-3);
  const boxWidth = 258;
  const lineHeight = 19;
  let y = HEIGHT - 74 - visible.length * lineHeight;

  for (const bark of visible) {
    const alpha = Math.min(1, (bark.ttl - bark.age) / 0.35, bark.age / 0.18);
    const x = WIDTH * 0.5 - boxWidth * 0.5;
    const label = `${bark.name}: `;
    const text = truncateText(ctx, `${label}${bark.text}`, boxWidth - 18);

    ctx.globalAlpha = alpha;
    ctx.fillStyle = "rgba(13, 3, 18, 0.76)";
    ctx.fillRect(x, y, boxWidth, 16);
    ctx.strokeStyle = speakerColors[bark.speaker] ?? speakerColors.system;
    ctx.strokeRect(x + 0.5, y + 0.5, boxWidth, 16);
    ctx.font = 'bold 9px "Courier New", monospace';
    ctx.fillStyle = speakerColors[bark.speaker] ?? speakerColors.system;
    ctx.fillText(text, x + 8, y + 11);
    ctx.globalAlpha = 1;
    y += lineHeight;
  }
}

function drawCabbageBubble(runtime, bark) {
  if (!bark) {
    return;
  }

  const { canvasContext: ctx, game } = runtime;
  const cabbage = game.cabbageSpirit;
  if (!cabbage) {
    return;
  }

  const anchor = projectWorldPoint(game, {
    x: cabbage.x,
    y: 1.58 + cabbage.bob,
    z: cabbage.z,
  });
  if (!anchor || anchor.sx < 0 || anchor.sx > WIDTH || anchor.sy < 0 || anchor.sy > HEIGHT) {
    return;
  }

  const alpha = Math.min(1, (bark.ttl - bark.age) / 0.35, bark.age / 0.16);
  if (alpha <= 0) {
    return;
  }

  const scale = clamp((FOCAL / anchor.z) * 0.042, 0.62, 1.08);
  const fontSize = Math.max(7, Math.round(9 * scale));
  const paddingX = Math.round(7 * scale);
  const paddingY = Math.round(5 * scale);
  const maxWidth = Math.round(154 * scale);
  const minWidth = Math.round(52 * scale);

  ctx.font = `bold ${fontSize}px "Courier New", monospace`;
  const text = truncateText(ctx, bark.text, maxWidth - paddingX * 2);
  const textWidth = ctx.measureText(text).width;
  const width = clamp(textWidth + paddingX * 2, minWidth, maxWidth);
  const height = Math.round(fontSize + paddingY * 2 + 2 * scale);
  const x = Math.round(anchor.sx - width * 0.5);
  const y = Math.round(anchor.sy - height - 7 * scale);
  const tailSize = Math.max(4, Math.round(5 * scale));

  ctx.globalAlpha = alpha;
  ctx.fillStyle = "rgba(10, 24, 25, 0.84)";
  ctx.strokeStyle = speakerColors.cabbage;
  ctx.lineWidth = 1;
  roundedRect(ctx, x, y, width, height, Math.max(4, Math.round(6 * scale)));
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(Math.round(anchor.sx - tailSize), y + height - 1);
  ctx.lineTo(Math.round(anchor.sx + tailSize), y + height - 1);
  ctx.lineTo(Math.round(anchor.sx), Math.round(anchor.sy - 1));
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = speakerColors.cabbage;
  ctx.fillText(text, x + paddingX, y + height - paddingY - Math.max(2, Math.round(2 * scale)));
  ctx.globalAlpha = 1;
}

function latestCabbageBark(barks) {
  for (let i = barks.length - 1; i >= 0; i -= 1) {
    if (isCabbageSpeaker(barks[i].speaker)) {
      return barks[i];
    }
  }
  return null;
}

function isCabbageSpeaker(speaker) {
  return speaker === "cabbage" || speaker === "cabbageSpirit";
}

function truncateText(ctx, text, maxWidth) {
  if (ctx.measureText(text).width <= maxWidth) {
    return text;
  }
  let result = text;
  while (result.length > 4 && ctx.measureText(`${result}...`).width > maxWidth) {
    result = result.slice(0, -1);
  }
  return `${result}...`;
}

function roundedRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width * 0.5, height * 0.5);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
