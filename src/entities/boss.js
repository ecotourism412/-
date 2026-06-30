import { ARENA, colors } from "../core/constants.js";
import { addShake, burst, pulseScreen } from "../core/effects.js";
import { clamp, lerp, lerpAngle } from "../core/math3d.js";
import { emitGameEvent } from "../dialogue/dialogueEvents.js";

export function updateBoss(runtime, dt) {
  const { game } = runtime;
  const boss = game.boss;
  if (!boss.active) {
    return;
  }

  const player = game.player;
  boss.hurt = Math.max(0, boss.hurt - dt * 2.8);
  boss.bob = Math.sin(game.time * 5 + boss.phase) * 0.12;
  boss.wiggle = Math.sin(game.time * 9 + boss.phase) * 0.04;
  boss.cooldownCharge = Math.max(0, boss.cooldownCharge - dt);
  boss.cooldownStomp = Math.max(0, boss.cooldownStomp - dt);

  const toPlayerX = player.x - boss.x;
  const toPlayerZ = player.z - boss.z;
  const dist = Math.hypot(toPlayerX, toPlayerZ) || 0.0001;
  const dirX = toPlayerX / dist;
  const dirZ = toPlayerZ / dist;

  if (boss.state !== "charge") {
    boss.yaw = lerpAngle(boss.yaw, Math.atan2(player.x - boss.x, player.z - boss.z), dt * 4.2);
  }

  if (boss.state !== "charge" && dist < 2.45) {
    player.hp -= boss.contactDamage * dt;
    player.flash = Math.max(player.flash, 0.6);
    emitGameEvent(runtime, "player_damaged", {
      wave: game.wave,
      hp: player.hp,
      bossHpRatio: boss.hp / boss.maxHp,
      source: "boss_contact",
    });
    if (game.hurtSoundTimer <= 0) {
      runtime.audio.playSound(game, "hurt");
      game.hurtSoundTimer = 0.28;
    }
  }

  switch (boss.state) {
    case "intro":
      boss.stateTimer -= dt;
      moveBossTowardPlayer(runtime, dt, 0.55, 0.18);
      if (Math.random() < dt * 20) {
        burst(
          game,
          boss.x + (Math.random() * 2 - 1) * 1.4,
          2.8 + Math.random() * 1.6,
          boss.z + (Math.random() * 2 - 1) * 1.4,
          colors.warning,
          1,
          0.4
        );
      }
      if (boss.stateTimer <= 0) {
        setBossState(runtime, "chase", 0);
        boss.cooldownCharge = 1.2;
        boss.cooldownStomp = 2.6;
      }
      break;

    case "chase":
      moveBossTowardPlayer(runtime, dt, 1, 0.26);
      if (boss.cooldownCharge <= 0 && dist > 4.2) {
        setBossState(runtime, "telegraphCharge", 0.8);
        runtime.audio.playSound(game, "bossWarn");
        pulseScreen(game, 0.08, colors.warning);
        emitGameEvent(runtime, "boss_charge_prepare", {
          wave: game.wave,
          bossHpRatio: boss.hp / boss.maxHp,
        });
      } else if (boss.cooldownStomp <= 0 && dist >= 3.5 && dist <= 9.5) {
        setBossState(runtime, "telegraphStomp", 0.9);
        runtime.audio.playSound(game, "bossPrep");
        pulseScreen(game, 0.06, colors.warningDeep);
        emitGameEvent(runtime, "boss_stomp_prepare", {
          wave: game.wave,
          bossHpRatio: boss.hp / boss.maxHp,
        });
      }
      break;

    case "telegraphCharge":
      boss.stateTimer -= dt;
      boss.vx = lerp(boss.vx, 0, dt * 7);
      boss.vz = lerp(boss.vz, 0, dt * 7);
      if (Math.random() < dt * 28) {
        burst(
          game,
          boss.x + Math.sin(boss.yaw) * 2.3,
          2.2 + Math.random() * 1.1,
          boss.z + Math.cos(boss.yaw) * 2.3,
          colors.warning,
          2,
          0.55
        );
      }
      if (boss.stateTimer <= 0) {
        triggerBossCharge(runtime, dirX, dirZ);
      }
      break;

    case "charge":
      boss.stateTimer -= dt;
      boss.vx = boss.chargeDirX * 16.2;
      boss.vz = boss.chargeDirZ * 16.2;
      boss.x = clamp(boss.x + boss.vx * dt, -ARENA + 2.2, ARENA - 2.2);
      boss.z = clamp(boss.z + boss.vz * dt, -ARENA + 2.2, ARENA - 2.2);
      burst(game, boss.x, 1.8, boss.z, colors.warningDeep, 3, 0.7);
      burst(game, boss.x - boss.chargeDirX * 1.6, 1.7, boss.z - boss.chargeDirZ * 1.6, colors.spark, 2, 0.6);
      if (!boss.chargeDidHit && Math.hypot(player.x - boss.x, player.z - boss.z) < 2.6) {
        boss.chargeDidHit = true;
        player.hp -= 24;
        player.flash = Math.max(player.flash, 1);
        emitGameEvent(runtime, "player_damaged", {
          wave: game.wave,
          hp: player.hp,
          bossHpRatio: boss.hp / boss.maxHp,
          source: "boss_charge",
        });
        player.x = clamp(player.x + boss.chargeDirX * 2.3, -ARENA + 2, ARENA - 2);
        player.z = clamp(player.z + boss.chargeDirZ * 2.3, -ARENA + 2, ARENA - 2);
        addShake(game, 0.92, 0.42);
        pulseScreen(game, 0.22, colors.warning);
        runtime.audio.playSound(game, "hurt");
      }
      if (
        boss.stateTimer <= 0 ||
        Math.abs(boss.x) > ARENA - 2.35 ||
        Math.abs(boss.z) > ARENA - 2.35
      ) {
        setBossState(runtime, "recover", 0.76);
        boss.cooldownCharge = 5.2;
        burst(game, boss.x, 1.6, boss.z, colors.warning, 8, 1.1);
      }
      break;

    case "telegraphStomp":
      boss.stateTimer -= dt;
      moveBossTowardPlayer(runtime, dt, 0.08, 0.05);
      if (Math.random() < dt * 30) {
        burst(
          game,
          boss.x + (Math.random() * 2 - 1) * 1.8,
          0.2,
          boss.z + (Math.random() * 2 - 1) * 1.8,
          colors.warningDeep,
          1,
          0.45
        );
      }
      if (boss.stateTimer <= 0) {
        triggerBossStomp(runtime);
      }
      break;

    case "stomp":
      boss.stateTimer -= dt;
      boss.vx = lerp(boss.vx, 0, dt * 8);
      boss.vz = lerp(boss.vz, 0, dt * 8);
      if (boss.stateTimer <= 0) {
        setBossState(runtime, "recover", 0.9);
        boss.cooldownStomp = 6.4;
      }
      break;

    case "recover":
      boss.stateTimer -= dt;
      moveBossTowardPlayer(runtime, dt, 0.28, 0.08);
      if (boss.stateTimer <= 0) {
        setBossState(runtime, "chase", 0);
      }
      break;

    default:
      setBossState(runtime, "chase", 0);
      break;
  }
}

export function damageBoss(runtime, damage, hitPoint, dir, critical) {
  const { game } = runtime;
  const boss = game.boss;
  boss.hp -= damage;
  boss.hurt = 1;
  if (boss.state !== "charge") {
    boss.vx += dir.x * 0.45;
    boss.vz += dir.z * 0.45;
  }

  burst(game, hitPoint.x, hitPoint.y, hitPoint.z, critical ? colors.spark : colors.bossAura, critical ? 18 : 10, 1.8);
  runtime.audio.playSound(game, critical ? "crit" : "hit");

  if (!boss.halfPlayed && boss.hp <= boss.maxHp * 0.5) {
    boss.halfPlayed = true;
    runtime.showToast("猪王装甲破裂！");
    runtime.audio.playSound(game, "bossHalf");
    addShake(game, 0.34, 0.28);
    pulseScreen(game, 0.12, colors.warning);
    emitGameEvent(runtime, "boss_half_hp", {
      wave: game.wave,
      bossHpRatio: boss.hp / boss.maxHp,
    });
  }

  if (!boss.lowHpPlayed && boss.hp > 0 && boss.hp <= boss.maxHp * 0.2) {
    boss.lowHpPlayed = true;
    emitGameEvent(runtime, "boss_low_hp", {
      wave: game.wave,
      bossHpRatio: boss.hp / boss.maxHp,
    });
  }

  if (boss.hp <= 0) {
    killBoss(runtime);
  }
}

function moveBossTowardPlayer(runtime, dt, speedScale, swayScale) {
  const { game } = runtime;
  const boss = game.boss;
  const player = game.player;
  const toPlayerX = player.x - boss.x;
  const toPlayerZ = player.z - boss.z;
  const dist = Math.hypot(toPlayerX, toPlayerZ) || 0.0001;
  const dirX = toPlayerX / dist;
  const dirZ = toPlayerZ / dist;
  const sway = Math.sin(game.time * 1.2 + boss.phase);
  const targetX = dirX + -dirZ * swayScale * sway;
  const targetZ = dirZ + dirX * swayScale * sway;
  const length = Math.hypot(targetX, targetZ) || 1;
  boss.vx = lerp(boss.vx, (targetX / length) * boss.speed * speedScale, dt * 2.8);
  boss.vz = lerp(boss.vz, (targetZ / length) * boss.speed * speedScale, dt * 2.8);
  boss.x = clamp(boss.x + boss.vx * dt, -ARENA + 2.2, ARENA - 2.2);
  boss.z = clamp(boss.z + boss.vz * dt, -ARENA + 2.2, ARENA - 2.2);
}

function setBossState(runtime, state, duration) {
  runtime.game.boss.state = state;
  runtime.game.boss.stateTimer = duration;
  runtime.game.boss.dialoguePhase = state;
}

function triggerBossCharge(runtime, dirX, dirZ) {
  const { game } = runtime;
  const boss = game.boss;
  setBossState(runtime, "charge", 1);
  boss.chargeDirX = dirX;
  boss.chargeDirZ = dirZ;
  boss.chargeDidHit = false;
  runtime.audio.playSound(game, "bossCharge");
  addShake(game, 0.32, 0.24);
  pulseScreen(game, 0.1, colors.warning);
}

function triggerBossStomp(runtime) {
  const { game } = runtime;
  const boss = game.boss;
  setBossState(runtime, "stomp", 0.18);
  game.shockwaves.push({
    x: boss.x,
    z: boss.z,
    radius: 0.7,
    maxRadius: 5.5,
    life: 0.72,
    total: 0.72,
    damage: 16,
    hitPlayer: false,
    visualOnly: false,
  });
  addShake(game, 0.62, 0.42);
  pulseScreen(game, 0.14, colors.warningDeep);
  burst(game, boss.x, 0.2, boss.z, colors.warningDeep, 16, 1.2);
  runtime.audio.playSound(game, "bossStomp");
}

function killBoss(runtime) {
  const { game } = runtime;
  const boss = game.boss;
  burst(game, boss.x, 2.4 + boss.bob, boss.z, colors.pigBody, 54, 3.2);
  burst(game, boss.x, 3.4 + boss.bob, boss.z, colors.spark, 42, 3.4);
  burst(game, boss.x, 1.4 + boss.bob, boss.z, colors.warning, 24, 2.6);
  game.shockwaves.push({
    x: boss.x,
    z: boss.z,
    radius: 0.8,
    maxRadius: 8.2,
    life: 0.8,
    total: 0.8,
    damage: 0,
    hitPlayer: true,
    visualOnly: true,
  });
  game.score += 1500 + game.wave * 150;
  game.kills += 1;
  boss.active = false;
  boss.dead = true;
  boss.state = "dead";
  addShake(game, 1.05, 0.72);
  pulseScreen(game, 0.28, colors.hit);
  runtime.audio.playSound(game, "bossDeath");
  runtime.audio.setMusicMode(game, "normal");
  runtime.showToast("猪王 MK-III 已坠毁！");
  emitGameEvent(runtime, "boss_killed", {
    wave: game.wave,
    bossHpRatio: 0,
    score: game.score,
  });
}
