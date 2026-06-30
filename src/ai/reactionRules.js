import { getPigPersonality } from "./personalities.js";

const bossLines = {
  intro: [
    "白菜地已经被猪王 MK-III 标记，守卫者，准备被碾碎！",
    "小小白菜，也敢拒绝钢铁猪蹄？",
  ],
  half: [
    "装甲裂了，但猪王的胃口还没裂！",
    "你惹怒了一台真正想拱白菜的机器！",
  ],
  charge: [
    "让开！猪王冲锋要把白菜连根掀起！",
    "看清楚，这一撞叫农业灾难！",
  ],
  stomp: [
    "地面震起来，白菜根也保不住！",
    "猪蹄落下，全场归猪！",
  ],
  killed: [
    "不可能……白菜怎么会有这样的守卫……",
    "猪王坠毁，白菜地暂时归你。",
  ],
};

const cabbageLines = {
  wave: [
    "白菜精灵上线：守住这片菜地，别让猪蹄靠近！",
    "白菜叶正在发抖，但我相信你能挡住这一波。",
  ],
  lowHp: [
    "守卫者，你快撑不住了，先拉开距离！",
    "白菜精灵提醒：别硬扛猪蹄，边退边打！",
  ],
  bossKilled: [
    "干得漂亮！这片白菜今晚能睡个安稳觉了。",
    "猪王倒下了，白菜地记住了你的名字。",
  ],
  gameOver: [
    "白菜被拱了……但下一局我们还能重整菜地。",
    "猪群冲破了防线，白菜精灵请求再次出战。",
  ],
};

export function getLocalReaction(event, snapshot) {
  switch (event.type) {
    case "wave_started":
      if (event.payload.wave === 1) {
        return cabbageSpirit(randomLine(cabbageLines.wave), 2, 4);
      }
      return null;
    case "player_low_hp":
      return cabbageSpirit(randomLine(cabbageLines.lowHp), 3, 3.4);
    case "game_over":
      return cabbageSpirit(randomLine(cabbageLines.gameOver), 4, 4);
    case "pig_hit":
      return pigReaction(event, "hitLines", snapshot);
    case "pig_dodged":
      return pigReaction(event, "dodgeLines", snapshot, 3);
    case "pig_killed":
      return pigReaction(event, "deathLines", snapshot, 2);
    case "boss_intro":
      return bossReaction(randomLine(bossLines.intro), 3, 4);
    case "boss_half_hp":
      return bossReaction(randomLine(bossLines.half), 4, 3.5);
    case "boss_charge_prepare":
      return bossReaction(randomLine(bossLines.charge), 2, 2.7);
    case "boss_stomp_prepare":
      return bossReaction(randomLine(bossLines.stomp), 2, 2.7);
    case "boss_killed":
      return cabbageSpirit(randomLine(cabbageLines.bossKilled), 4, 3.8);
    default:
      return null;
  }
}

function pigReaction(event, lineKey, snapshot, priority = 1) {
  const personality = getPigPersonality(event.payload.personality);
  const lines = personality[lineKey];
  if (!lines?.length) {
    return null;
  }

  if (lineKey === "hitLines" && Math.random() > 0.22) {
    return null;
  }

  return {
    speaker: "pig",
    name: personality.name,
    text: randomLine(lines),
    tone: event.payload.critical ? "sharp" : "taunt",
    priority,
    ttl: snapshot.bossActive ? 2.2 : 2.5,
  };
}

function bossReaction(text, priority, ttl) {
  return {
    speaker: "boss",
    name: "猪王 MK-III",
    text,
    tone: "threat",
    priority,
    ttl,
  };
}

function cabbageSpirit(text, priority, ttl) {
  return {
    speaker: "cabbageSpirit",
    name: "白菜精灵",
    text,
    tone: "support",
    priority,
    ttl,
  };
}

function randomLine(lines) {
  return lines[Math.floor(Math.random() * lines.length)];
}
