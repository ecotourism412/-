const MAX_BARKS = 4;

export function createDialogueState() {
  return {
    nextId: 1,
    barks: [],
    ai: {
      firstPigHitSpoken: false,
      recentHitTimes: [],
      pigBarkTimes: [],
      lastPigHitBarkAt: -Infinity,
      lastCabbageKillAt: -Infinity,
      lastPlayerDamagedAt: -Infinity,
      bossPhaseSpoken: {},
      bossBanterSpoken: {},
      recentEvents: [],
      recentDialogue: [],
      avoidTexts: [],
      chatHistory: [],
      dramaticMoments: [],
      playerProfile: {
        shots: 0,
        hits: 0,
        misses: 0,
        damageTakenCount: 0,
        lowHpWarnings: 0,
        recentHitCount: 0,
      },
    },
  };
}

export function enqueueBark(dialogue, bark) {
  if (!bark?.text) {
    return null;
  }

  const item = {
    id: dialogue.nextId,
    speaker: bark.speaker,
    name: bark.name ?? speakerName(bark.speaker),
    text: bark.text,
    intent: bark.intent ?? "",
    emotion: bark.emotion ?? "",
    tone: bark.tone ?? "neutral",
    priority: bark.priority ?? 1,
    ttl: bark.ttl ?? 2.8,
    eventType: bark.eventType ?? "",
    sourceType: bark.sourceType ?? "",
    voiceSlot: bark.voiceSlot ?? "",
    voiceEnabled: Boolean(bark.voiceEnabled),
    voiceStyle: bark.voiceStyle ?? "",
    voicePriority: bark.voicePriority ?? bark.priority ?? 1,
    forceVoice: Boolean(bark.forceVoice),
    canDrop: Boolean(bark.canDrop ?? bark.canBeDropped),
    age: 0,
  };
  dialogue.nextId += 1;

  dialogue.barks.push(item);
  if (dialogue.barks.length > MAX_BARKS) {
    dialogue.barks.sort((a, b) => b.priority - a.priority || a.age - b.age);
    dialogue.barks.splice(MAX_BARKS);
  }
  return item;
}

export function updateDialogue(dialogue, dt) {
  for (const bark of dialogue.barks) {
    bark.age += dt;
  }
  dialogue.barks = dialogue.barks.filter((bark) => bark.age < bark.ttl);
}

export function speakerName(speaker) {
  if (speaker === "boss" || speaker === "pigKing") {
    return "猪王 MK-III";
  }
  if (speaker === "cabbageSpirit" || speaker === "cabbage") {
    return "白菜精灵";
  }
  if (speaker === "pig") {
    return "机器猪";
  }
  return "系统";
}
