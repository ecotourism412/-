const VOICE_STYLE = {
  cabbage: "small_nervous",
  cabbageSpirit: "small_nervous",
  pig: "pig_grunt",
  pigKing: "deep_boss",
};

export function applyVoicePolicy(bark) {
  const speaker = bark?.speaker;
  const priority = bark?.priority ?? 1;
  const canDrop = Boolean(bark?.canDrop ?? bark?.canBeDropped);
  const forceVoice = Boolean(bark?.forceVoice);

  return {
    ...bark,
    voiceEnabled: forceVoice || shouldEnableVoice(speaker, priority),
    voiceStyle: VOICE_STYLE[speaker] ?? bark?.voiceStyle ?? "small_nervous",
    voicePriority: voicePriorityFor(speaker, priority),
    canDrop,
    forceVoice,
  };
}

function shouldEnableVoice(speaker, priority) {
  if (speaker === "cabbage" || speaker === "cabbageSpirit") {
    return priority >= 2;
  }
  if (speaker === "pigKing") {
    return priority >= 3;
  }
  if (speaker === "pig") {
    return priority <= 1;
  }
  return false;
}

function voicePriorityFor(speaker, priority) {
  if (speaker === "pigKing") {
    return 4;
  }
  if (speaker === "cabbage" || speaker === "cabbageSpirit") {
    return 2;
  }
  if (speaker === "pig") {
    return 3;
  }
  return priority;
}
