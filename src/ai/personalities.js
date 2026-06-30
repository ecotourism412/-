export const PIG_PERSONALITIES = [
  {
    id: "coward",
    name: "胆小猪",
    dodgeChance: 0.24,
    hitLines: ["别打我！我只是拱过两棵白菜！", "你这准星也太凶了吧！"],
    dodgeLines: ["嘿嘿，胆小也能活命！", "我躲！白菜先借我抱一下！"],
    deathLines: ["早知道不拱白菜了……"],
  },
  {
    id: "snarky",
    name: "嘴贱猪",
    dodgeChance: 0.18,
    hitLines: ["就这？打疼了但没打服。", "你保护白菜的姿势很狼狈。"],
    dodgeLines: ["空枪！白菜都笑了。", "你是不是把准星落家里了？"],
    deathLines: ["这局算白菜赢……"],
  },
  {
    id: "berserk",
    name: "狂躁猪",
    dodgeChance: 0.12,
    hitLines: ["疼！但我还要拱！", "白菜地归猪群！"],
    dodgeLines: ["冲冲冲！躲完继续拱！", "你挡不住猪潮！"],
    deathLines: ["猪群不会停下！"],
  },
  {
    id: "cool",
    name: "装酷猪",
    dodgeChance: 0.2,
    hitLines: ["这枪，有点意思。", "白菜守卫，水平尚可。"],
    dodgeLines: ["预判了你的预判。", "风从白菜叶尖吹过。"],
    deathLines: ["保持冷静……下次再拱。"],
  },
];

export function pickPigPersonality(wave, guard) {
  const pool = guard ? PIG_PERSONALITIES.filter((item) => item.id !== "coward") : PIG_PERSONALITIES;
  const index = Math.floor((Math.random() * pool.length + wave) % pool.length);
  return pool[index];
}

export function getPigPersonality(id) {
  return PIG_PERSONALITIES.find((item) => item.id === id) ?? PIG_PERSONALITIES[0];
}
