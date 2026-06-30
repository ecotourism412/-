import { TAU, colors } from "./constants.js";
import { createDialogueState } from "../dialogue/dialogueState.js";

export function makeGame() {
  return {
    time: 0,
    wave: 1,
    score: 0,
    shots: 0,
    kills: 0,
    waveTimer: 0,
    pendingNextWave: false,
    encounterType: "normal",
    hurtSoundTimer: 0,
    screenPulse: 0,
    screenPulseColor: colors.hit,
    player: createPlayerState(),
    cabbageSpirit: createCabbageSpiritState(),
    pigs: [],
    boss: createBossState(),
    particles: [],
    tracers: [],
    shockwaves: [],
    screenShake: {
      time: 0,
      strength: 0,
      x: 0,
      y: 0,
    },
    musicState: {
      mode: "none",
      nextNoteAt: 0,
      step: 0,
      nodesReady: false,
      duckUntil: 0,
    },
    dialogue: createDialogueState(),
    pausedForOrientation: false,
    pausedForChat: false,
    nextPigId: 1,
    lowHpWarningPlayed: false,
  };
}

export function createPlayerState() {
  return {
    x: 0,
    z: -10,
    yaw: 0,
    hp: 100,
    maxHp: 100,
    cooldown: 0,
    bob: 0,
    bobPhase: 0,
    recoil: 0,
    flash: 0,
    muzzle: 0,
  };
}

export function createCabbageSpiritState() {
  return {
    x: -0.85,
    z: -12.8,
    yaw: 0,
    bob: 0,
    phase: Math.random() * TAU,
    jump: 0,
    jumpVelocity: 0,
    squash: 0,
    expression: "calm",
    expressionUntil: 0,
    speakPulse: 0,
    followLag: [],
    nextHopAt: 2 + Math.random() * 2.4,
    blink: 0,
    blinkUntil: 0,
    nextBlinkAt: 1.4 + Math.random() * 2.2,
    lastBarkId: null,
  };
}

export function createBossState() {
  return {
    active: false,
    dead: false,
    hp: 0,
    maxHp: 0,
    x: 0,
    z: 0,
    vx: 0,
    vz: 0,
    yaw: 0,
    state: "idle",
    stateTimer: 0,
    cooldownCharge: 0,
    cooldownStomp: 0,
    introTimer: 0,
    hurt: 0,
    phase: Math.random() * TAU,
    bob: 0,
    wiggle: 0,
    halfPlayed: false,
    lowHpPlayed: false,
    speed: 0,
    contactDamage: 0,
    chargeDirX: 0,
    chargeDirZ: 0,
    chargeDidHit: false,
    scale: 2.6,
    lastThreatAt: -999,
    dialoguePhase: "idle",
  };
}
