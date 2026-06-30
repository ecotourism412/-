import { ARENA, TAU, colors } from "../core/constants.js";
import { addShake, burst, pulseScreen } from "../core/effects.js";
import { createBossState } from "../core/gameState.js";
import { clamp } from "../core/math3d.js";
import { createPig } from "../entities/pig.js";
import { emitGameEvent } from "../dialogue/dialogueEvents.js";

export function startEncounter(runtime, wave) {
  const { game } = runtime;
  game.wave = wave;
  game.encounterType = isBossWave(wave) ? "boss" : "normal";
  game.pendingNextWave = false;
  game.waveTimer = 0;

  if (game.encounterType === "boss") {
    spawnBossWave(runtime, wave);
    runtime.audio.setMusicMode(game, "boss");
    if (wave === 2) {
      runtime.showToast("警报：第二波猪王提前入场！");
    } else {
      runtime.showToast(`警报：第 ${wave} 波猪王入场！`);
    }
  } else {
    spawnWave(runtime, wave);
    runtime.audio.setMusicMode(game, "normal");
    runtime.showToast(`第 ${wave} 波机猪入场。`);
  }

  emitGameEvent(runtime, "wave_started", {
    wave,
    hp: game.player.hp,
    score: game.score,
  });
}

export function isBossWave(wave) {
  return wave % 2 === 0;
}

export function updateWave(runtime, dt) {
  const { game } = runtime;
  const encounterCleared =
    game.encounterType === "boss" ? !game.boss.active && game.pigs.length === 0 : game.pigs.length === 0;

  if (!encounterCleared) {
    game.pendingNextWave = false;
    return;
  }

  if (!game.pendingNextWave) {
    game.pendingNextWave = true;
    game.waveTimer = game.encounterType === "boss" ? 2.6 : 2.2;
    if (game.encounterType === "boss") {
      game.player.hp = Math.min(game.player.maxHp, game.player.hp + 18);
      runtime.showToast("猪王倒下，能量回收 +18 HP。");
    } else {
      runtime.showToast(`第 ${game.wave + 1} 波正在接近。`);
    }
  }

  game.waveTimer -= dt;
  if (game.waveTimer <= 0) {
    startEncounter(runtime, game.wave + 1);
  }
}

function spawnWave(runtime, wave) {
  const { game } = runtime;
  const count = Math.min(8 + wave * 3, 28);
  for (let i = 0; i < count; i += 1) {
    const angle = (TAU * i) / count + Math.random() * 0.6;
    const radius = 16 + Math.random() * 11;
    const x = clamp(game.player.x + Math.cos(angle) * radius, -ARENA + 2, ARENA - 2);
    const z = clamp(game.player.z + Math.sin(angle) * radius, -ARENA + 2, ARENA - 2);
    game.pigs.push(createPig(game, x, z, wave, false));
  }
}

function spawnBossWave(runtime, wave) {
  const { game } = runtime;
  const angle = Math.random() * TAU;
  const radius = 21;
  const x = clamp(game.player.x + Math.cos(angle) * radius, -ARENA + 4, ARENA - 4);
  const z = clamp(game.player.z + Math.sin(angle) * radius, -ARENA + 4, ARENA - 4);
  const hp = wave === 2 ? 52 : 52 + (wave - 2) * 12;
  const speed = wave === 2 ? 1.35 : 1.35 + (wave - 2) * 0.06;
  const guards = Math.min(5 + wave, 12);

  game.boss = createBossState();
  game.boss.active = true;
  game.boss.hp = hp;
  game.boss.maxHp = hp;
  game.boss.x = x;
  game.boss.z = z;
  game.boss.yaw = Math.atan2(game.player.x - x, game.player.z - z);
  game.boss.state = "intro";
  game.boss.stateTimer = 3;
  game.boss.introTimer = 3;
  game.boss.speed = speed;
  game.boss.contactDamage = wave === 2 ? 16 : 16 + (wave - 2) * 0.55;
  game.boss.cooldownCharge = 999;
  game.boss.cooldownStomp = 999;

  for (let i = 0; i < guards; i += 1) {
    const guardAngle = angle + (TAU * i) / guards + Math.random() * 0.4;
    const guardRadius = 4.2 + Math.random() * 3.5;
    const guardX = clamp(x + Math.cos(guardAngle) * guardRadius, -ARENA + 2, ARENA - 2);
    const guardZ = clamp(z + Math.sin(guardAngle) * guardRadius, -ARENA + 2, ARENA - 2);
    game.pigs.push(createPig(game, guardX, guardZ, wave, true));
  }

  game.shockwaves.push({
    x,
    z,
    radius: 0.8,
    maxRadius: 7.5,
    life: 0.76,
    total: 0.76,
    damage: 0,
    hitPlayer: true,
    visualOnly: true,
  });

  burst(game, x, 2.8, z, colors.bossAura, 28, 2.4);
  burst(game, x, 1.5, z, colors.warning, 18, 1.8);
  addShake(game, 0.62, 0.48);
  pulseScreen(game, 0.16, colors.warningDeep);
  runtime.audio.playSound(game, "bossIntro");
  emitGameEvent(runtime, "boss_intro", {
    wave,
    bossHpRatio: 1,
  });
}
