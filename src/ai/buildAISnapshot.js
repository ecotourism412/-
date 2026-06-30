export function buildAISnapshot(runtime, event, decision) {
  const game = runtime?.game ?? {};
  const payload = event?.payload ?? {};
  const player = game.player ?? {};
  const boss = game.boss ?? {};
  const dialogue = game.dialogue ?? {};
  const ai = dialogue.ai ?? {};
  const playerProfile = normalizePlayerProfile(ai.playerProfile, game);
  const enemy = findEnemy(game, payload);
  const now = Number.isFinite(game.time) ? game.time : 0;
  const recentHitTimes = Array.isArray(dialogue.recentHitTimes) ? dialogue.recentHitTimes : [];
  const recentEvents = safeList(dialogue.recentEvents);
  const dramaticMoments = safeList(ai.dramaticMoments ?? dialogue.dramaticMoments);

  return {
    eventType: decision?.eventType ?? event?.type ?? null,
    speakerType: decision?.speakerType ?? null,
    intentHint: decision?.intentHint ?? null,
    emotionHint: decision?.emotionHint ?? null,
    player: {
      hp: numberOrNull(player.hp),
      maxHp: numberOrNull(player.maxHp),
      isLowHp: isLowHp(player),
      combo: recentHitTimes.length >= 3,
      recentHitCount: recentHitTimes.length,
      profile: playerProfile,
      styleTags: getPlayerStyleTags(playerProfile, player),
    },
    wave: {
      index: numberOrNull(game.wave ?? payload.wave),
      isBossWave: isBossWave(game.wave ?? payload.wave),
    },
    enemy: enemy
      ? {
          id: enemy.id ?? payload.pigId ?? null,
          type: enemy.guard ? "guardPig" : "pig",
          personality: enemy.personality ?? payload.personality ?? null,
          hp: numberOrNull(enemy.hp),
          dodgeChance: numberOrNull(enemy.dodgeChance),
        }
      : {
          id: payload.pigId ?? null,
          type: payload.pigId ? "pig" : null,
          personality: payload.personality ?? null,
          hp: null,
          dodgeChance: null,
        },
    boss: {
      phase: boss.state ?? null,
      hp: numberOrNull(boss.hp),
      maxHp: numberOrNull(boss.maxHp),
      hpRatio: getBossHpRatio(boss, payload),
      dialoguePhase: boss.dialoguePhase ?? null,
    },
    context: {
      recentEvents,
      recentDialogue: safeList(dialogue.recentDialogue),
      avoidTexts: safeList(ai.avoidTexts ?? dialogue.avoidTexts),
      chatHistory: safeList(ai.chatHistory ?? dialogue.chatHistory),
      dramaticMoments,
      recentMoment: getRecentMoment(event, recentEvents, dramaticMoments),
      timestamp: now,
    },
  };
}

function findEnemy(game, payload) {
  if (!payload?.pigId || !Array.isArray(game?.pigs)) {
    return null;
  }
  return game.pigs.find((pig) => pig.id === payload.pigId) ?? null;
}

function getBossHpRatio(boss, payload) {
  if (Number.isFinite(payload?.bossHpRatio)) {
    return payload.bossHpRatio;
  }
  if (!Number.isFinite(boss?.hp) || !Number.isFinite(boss?.maxHp) || boss.maxHp <= 0) {
    return null;
  }
  return boss.hp / boss.maxHp;
}

function isLowHp(player) {
  if (!Number.isFinite(player?.hp) || !Number.isFinite(player?.maxHp) || player.maxHp <= 0) {
    return false;
  }
  return player.hp / player.maxHp <= 0.35;
}

function isBossWave(wave) {
  return Number.isFinite(wave) ? wave % 2 === 0 : null;
}

function numberOrNull(value) {
  return Number.isFinite(value) ? value : null;
}

function safeList(value) {
  return Array.isArray(value) ? value.slice(-8) : [];
}

function normalizePlayerProfile(profile, game) {
  const hits = numberOrZero(profile?.hits);
  const shots = Number.isFinite(game?.shots) ? game.shots : numberOrZero(profile?.shots);
  return {
    shots,
    hits,
    misses: Math.max(0, shots - hits),
    damageTakenCount: numberOrZero(profile?.damageTakenCount),
    lowHpWarnings: numberOrZero(profile?.lowHpWarnings),
    recentHitCount: numberOrZero(profile?.recentHitCount),
  };
}

function numberOrZero(value) {
  return Number.isFinite(value) ? value : 0;
}

function getPlayerStyleTags(profile, player) {
  const tags = [];
  const accuracy = profile.shots > 0 ? profile.hits / profile.shots : 0;
  if (profile.shots >= 8 && accuracy >= 0.55) {
    tags.push("accurate");
  }
  if (profile.shots >= 8 && accuracy <= 0.22) {
    tags.push("missing_often");
  }
  if (profile.lowHpWarnings > 0 || isLowHp(player)) {
    tags.push("low_hp_survivor");
  }
  if (profile.recentHitCount >= 2) {
    tags.push("combo");
  }
  if (profile.damageTakenCount >= 3) {
    tags.push("under_pressure");
  }
  return tags;
}

function getRecentMoment(event, recentEvents, dramaticMoments) {
  if (event?.type === "boss_charge_prepare" || event?.type === "boss_stomp_prepare") {
    return "boss_charge_warning";
  }
  if (event?.type === "player_low_hp") {
    return "player_low_hp";
  }
  if (event?.type === "boss_half_hp") {
    return "boss_half_hp";
  }
  if (event?.type === "boss_killed") {
    return "boss_killed";
  }
  const latestDramatic = dramaticMoments[dramaticMoments.length - 1]?.type;
  if (latestDramatic) {
    return latestDramatic;
  }
  return recentEvents[recentEvents.length - 1]?.type ?? null;
}
