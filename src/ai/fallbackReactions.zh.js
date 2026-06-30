const FALLBACK_LINES = {
  cabbage: {
    PLAYER_HIT_PIG: ["它退了半步！", "这下打得它发懵！", "我刚才差点喊出来！"],
    PLAYER_COMBO: ["你节奏起来了！", "它们开始乱了！", "别停，这波有机会！"],
    PLAYER_DAMAGED: ["别贴太近，我害怕！", "先拉开一点点！", "我看见它撞过来了！"],
    PLAYER_LOW_HP: ["慢一点，先活下来！", "别赌了，我叶子都僵了！", "我们先撑住这一口气！"],
    PIG_DEATH: ["少一只，菜地轻一点了！", "它倒了，我能喘气了！", "白菜叶终于没那么抖了！"],
    WAVE_STARTED: ["它们来了，我跟着你！", "菜地交给你，我不乱跑！", "我会盯着猪蹄声！"],
    GAME_OVER: ["别难过，我们再守一次。", "这片菜地还等你回来。", "我记得你刚才撑了很久。"],
    BOSS_ENTER: ["它太大了，但我不躲。", "我怕，可我还在你旁边。", "别让它吓住我们。"],
    BOSS_HALF_HP: ["它装甲裂了，继续压住！", "它开始急了，别松手！", "我听见它嘴硬了！"],
    BOSS_CHARGE: ["它要撞了，别站直线！", "猪王在蓄力，快闪开！", "它冲过来了，我怕！"],
    BOSS_LOW_HP: ["它快撑不住了，稳住！", "再坚持一下，别贪枪！", "它慌了，我们也别乱！"],
    BOSS_DEATH: ["它倒下了……白菜还在！", "我们守住了，我真的看见了！", "今晚菜地能安静了。"],
    PLAYER_CHAT: ["我在，别一个人扛。", "你说，我听着呢。", "我会陪你看着菜地。"],
  },
  pig: {
    PIG_HIT: ["哎哟！", "疼疼疼！", "别打脸！"],
    PIG_DODGE: ["打不着！", "嘿，歪了！", "我躲开！"],
    PIG_DEATH: ["还没吃到……", "白菜等等我……", "这口亏了……"],
  },
  pigKing: {
    BOSS_ENTER: ["把白菜交出来，我只吃一颗。", "我闻到了白菜的命运。", "小守卫，别挡猪王开饭。"],
    BOSS_HALF_HP: ["你为了白菜，竟敢打伤我？", "白菜值得你这样拼命？", "装甲裂了，胃口没裂！"],
    BOSS_CHARGE: ["我连你和白菜一起拱翻！", "挡我者，连菜根都不留！", "猪王冲锋，不讲道理！"],
    BOSS_LOW_HP: ["我离白菜明明这么近了……", "一颗白菜而已，为什么！", "我还没咬到，不许结束！"],
    BOSS_DEATH: ["我只是……想吃一颗白菜……", "白菜……我还没咬到……", "这片菜地，竟然没归我……"],
    PLAYER_CHAT: ["小守卫，嘴硬救不了白菜。", "让我回话？先交白菜。", "猪王听见了，也饿了。"],
  },
};

const VOICE_STYLE = {
  cabbage: "small_nervous",
  pig: "pig_grunt",
  pigKing: "deep_boss",
};

export function getFallbackReaction(decision, snapshot) {
  if (!decision?.shouldRequestAI || !decision.speakerType || !decision.eventType) {
    return null;
  }

  const lines = FALLBACK_LINES[decision.speakerType]?.[decision.eventType];
  if (!lines?.length) {
    return null;
  }

  return {
    speaker: decision.speakerType,
    text: pickLine(lines, snapshot),
    intent: decision.intentHint ?? intentForEvent(decision.eventType, decision.speakerType),
    emotion: decision.emotionHint ?? emotionForTone(decision.toneHint),
    tone: decision.toneHint ?? "nervous",
    priority: decision.priority ?? 1,
    ttl: getTtlMs(decision.speakerType, decision.priority),
    shouldSpeak: true,
    shouldVoice: false,
    voiceStyle: VOICE_STYLE[decision.speakerType] ?? "small_nervous",
    interrupt: Boolean(decision.interrupt),
    canBeDropped: Boolean(decision.canBeDropped),
    delayMs: decision.delayMs ?? 0,
  };
}

function pickLine(lines, snapshot) {
  const avoidTexts = new Set(snapshot?.context?.avoidTexts ?? []);
  const available = lines.filter((line) => !avoidTexts.has(line));
  const pool = available.length ? available : lines;
  const seed = Math.floor(((snapshot?.context?.timestamp ?? 0) * 1000) + lines.length);
  return pool[Math.abs(seed) % pool.length];
}

function getTtlMs(speakerType, priority) {
  if (speakerType === "pigKing" || priority >= 3) {
    return 3600;
  }
  if (speakerType === "pig") {
    return 2200;
  }
  return 3000;
}

function intentForEvent(eventType, speakerType) {
  if (eventType === "PLAYER_CHAT") {
    return speakerType === "pigKing" ? "taunt" : "chat_reply";
  }
  if (eventType === "PLAYER_LOW_HP" || eventType === "PLAYER_DAMAGED" || eventType === "BOSS_CHARGE") {
    return "warn";
  }
  if (eventType === "PLAYER_COMBO" || eventType === "PIG_DEATH" || eventType === "BOSS_DEATH") {
    return speakerType === "pigKing" || speakerType === "pig" ? "taunt" : "celebrate";
  }
  if (speakerType === "pig" || speakerType === "pigKing") {
    return "taunt";
  }
  return "encourage";
}

function emotionForTone(tone) {
  if (tone === "excited") {
    return "excited";
  }
  if (tone === "hurt") {
    return "hurt";
  }
  if (tone === "angry") {
    return "angry";
  }
  if (tone === "sad") {
    return "sad";
  }
  if (tone === "absurd") {
    return "teasing";
  }
  if (tone === "threatening") {
    return "angry";
  }
  return "nervous";
}
