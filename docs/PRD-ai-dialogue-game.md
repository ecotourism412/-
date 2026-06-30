# 《保卫白菜》AI 角色对白游戏 PRD

## 1. 产品定义

《保卫白菜》是一款 Canvas 伪 3D 射击游戏。玩家在白菜地中移动、射击、抵御普通猪和猪王。

本产品的最终形态不是单纯射击小游戏，而是“战斗事件驱动的 AI 角色对白游戏”。语言模型负责让角色在战斗中说出符合性格和剧情位置的短对白，增强陪伴感、敌人反应和 Boss 戏剧性。

AI 不参与战斗规则，不决定伤害、命中、移动、血量、波次、胜负。AI 只负责“谁在什么时机说什么”中的“说什么”。

## 2. 核心体验

玩家体验目标：

- 玩家感觉自己在保护一片白菜地。
- 白菜小精灵陪在玩家身边，紧张、碎嘴、关心玩家。
- 普通猪会偶尔嘴碎，但不能抢戏。
- 猪王是主要反派，围绕“我只是想吃一颗白菜”不断自我合理化。
- 战斗事件能触发即时、有性格、短促的中文对白。
- 即使 AI 服务失败，游戏仍能正常运行，并回退到本地文案。

## 3. 角色体系

### 3.1 白菜小精灵 `cabbage`

定位：陪伴型 AI 角色。

它陪在玩家旁边，不参与战斗。它不是系统提示，不是教程，不是机械旁白。

性格：

- 胆小。
- 碎嘴。
- 关心玩家。
- 容易紧张。
- 害怕但会鼓励玩家。

可触发场景：

- 玩家命中猪。
- 玩家连续命中。
- 玩家被攻击。
- 玩家低血量。
- 猪王出现。
- 猪王死亡。
- Game Over。

对白限制：

- 一次只说一句。
- 中文短对白。
- 不超过 25 个中文字。
- 不解释游戏机制。
- 不说“系统检测到”“血量数值”“伤害数值”等机械词。

### 3.2 普通猪 `pig`

定位：低频嘴碎型敌人。

普通猪有不同性格：

- `greedy`：贪吃。
- `coward`：胆小。
- `arrogant`：自大。
- `dramatic`：戏精。
- `dumb`：笨拙。

可触发场景：

- 被打。
- 闪避。
- 死亡。
- 冲锋。

对白限制：

- 每句不超过 10 个中文字。
- 普通猪不要抢戏。
- 多数时候只显示文字气泡。
- 普通猪文字气泡每分钟最多 4 次。
- 普通猪 TTS 每 15 秒最多 1 次。
- 普通猪语音排队超过 2 秒还没播，直接丢弃。

### 3.3 猪王 `pigKing`

定位：主要反派 AI 角色。

猪王是 Boss，不是普通敌人。

核心执念：

> 我只是想吃一颗白菜。

性格：

- 自大。
- 贪婪。
- 执着。
- 会自我合理化。

语气：

- 威胁。
- 荒诞。
- 愤怒。
- 不甘。

可触发场景：

- Boss 入场。
- Boss 半血。
- Boss 蓄力。
- Boss 低血量。
- Boss 死亡。

对白限制：

- 每句不超过 30 个中文字。
- 不说脏话。
- 不过度血腥。
- 不解释 Boss 技能机制。
- Boss 关键事件可以无视普通冷却。
- 每个 Boss 阶段只触发一次。
- Boss 入场允许连续 1-2 句。

## 4. 最终 AI 架构

AI 系统必须是事件驱动，而不是帧驱动。

目标链路：

```text
game event
→ aiScheduler
→ buildPromptForRole
→ callModelForRole
→ validateDialogue
→ enqueueBark
→ render text bubble
→ optional TTS queue
```

职责边界：

- 游戏代码负责产生事件。
- `aiScheduler` 负责判断谁该说话、是否冷却、是否排队、是否拆分多角色发言。
- `buildPromptForRole` 只读取当前说话角色的设定。
- `callModelForRole` 根据角色配置选择模型。
- `validateDialogue` 负责裁剪长度、过滤违规输出、保证一句话。
- `enqueueBark` 负责进入对白显示队列。
- TTS 队列只负责语音播放，不影响文字对白和游戏运行。

禁止架构：

```text
把三个角色设定塞进同一个 prompt
→ 让模型自己决定谁说话
→ 一次返回多角色对白
```

正确规则：

- 一次语言模型调用只生成一个角色的一句对白。
- 如果一个事件需要多个角色说话，必须拆成多次独立调用。
- 多角色对白通过队列和延迟播放组织顺序。

示例：

```text
Boss 入场
→ pigKing 先说一句
→ 延迟 0.8-1.5 秒
→ cabbage 再反应一句
```

## 5. 事件协议

游戏层只发结构化事件，不直接拼 prompt。

事件基础结构：

```js
{
  type: "boss_intro",
  speakerHint: "pigKing",
  priority: "critical",
  payload: {
    wave,
    playerHpState,
    bossPhase,
    pigPersonality,
    comboState,
    recentOutcome
  }
}
```

事件类型应覆盖：

- `wave_started`
- `pig_hit`
- `pig_dodged`
- `pig_killed`
- `pig_charge`
- `player_hit`
- `player_combo_hit`
- `player_low_hp`
- `boss_intro`
- `boss_half_hp`
- `boss_charge_prepare`
- `boss_low_hp`
- `boss_killed`
- `game_over`

事件 payload 只能传必要上下文，不传完整游戏对象。

## 6. Prompt 组织

角色设定必须拆分：

```text
src/ai/roles/cabbage.js
src/ai/roles/pig.js
src/ai/roles/pigKing.js
```

`buildPromptForRole(speakerType, event, gameSnapshot)` 只能读取当前 `speakerType` 对应的角色设定。

Prompt 必须包含：

- 当前角色设定。
- 当前事件。
- 必要游戏上下文。
- 输出字数限制。
- 禁止事项。
- “只输出一句中文对白”。

Prompt 不得包含：

- 其他角色完整设定。
- API Key。
- 战斗实现细节。
- 让模型决定发言角色的指令。

## 7. 模型策略

不同角色允许使用不同模型。

模型分配原则：

- `cabbage`：快模型 / 便宜模型。
- `pig`：便宜模型，低频调用，也可以大量使用本地规则文案。
- `pigKing`：更强模型，因为它承担主要戏剧张力。
- 关键情绪节点：允许使用更强模型，例如 Game Over、Boss 死亡。

角色模型配置示例：

```js
{
  speakerType: "pigKing",
  modelConfig: {
    tier: "strong",
    maxChars: 30,
    temperature: 0.8
  }
}
```

模型配置必须属于 AI 层或服务端配置，不得写死在战斗逻辑中。

## 8. Serverless Proxy

前端不得保存 API Key。

所有外部语言模型请求必须经过后端或 serverless proxy。

Proxy 职责：

- 保存 API Key。
- 接收角色类型、事件、上下文。
- 校验请求字段。
- 选择模型。
- 调用外部语言模型。
- 校验和裁剪输出。
- 返回一句中文对白。
- 失败时返回明确错误，让前端回退本地文案。

前端只允许发送：

- `speakerType`
- `eventType`
- `eventPayload`
- `gameSnapshot`

前端不允许发送：

- API Key。
- 完整 prompt 模板。
- 不必要的完整游戏状态。

## 9. 对白队列

对白输出分两层：

- 文字气泡：基础输出，必须可靠。
- TTS：可选增强，失败不影响文字。

队列规则：

- 高优先级对白可以覆盖低优先级对白。
- Boss 关键事件优先级最高。
- 白菜小精灵优先级中高。
- 普通猪优先级低。
- 普通猪过期语音直接丢弃。
- 队列必须避免刷屏。

对白对象结构：

```js
{
  speaker: "cabbage",
  text: "别怕，我还在！",
  tone: "nervous",
  priority: 3,
  ttl: 3.5,
  tts: true
}
```

## 10. 失败回退

AI 服务失败时：

- 游戏继续运行。
- 文字对白回退本地规则文案。
- TTS 失败直接跳过。
- 不弹出技术错误。
- 不阻塞战斗循环。

失败包括：

- 网络失败。
- 模型超时。
- 输出为空。
- 输出太长。
- 输出不符合角色。
- Proxy 返回错误。

## 11. 产品验收

体验验收：

- 玩家能感到白菜小精灵在陪伴自己。
- 普通猪偶尔嘴碎，但不会抢戏。
- 猪王有明确反派人格。
- Boss 关键阶段有戏剧对白。
- Game Over 有情绪反馈。
- 对白短、快、像角色说的话。

技术验收：

- 不每帧调用 AI。
- 前端无 API Key。
- 一次模型调用只生成一个角色一句对白。
- 不同角色可用不同模型。
- 模型失败可回退。
- TTS 失败不影响游戏。
- AI 不改变移动、射击、伤害、命中、波次、胜负。

## 12. 非目标

本产品不要求：

- 不要求 AI 控制敌人移动。
- 不要求 AI 决定胜负。
- 不要求 AI 生成关卡。
- 不要求玩家自由文本输入。
- 不要求复杂剧情树。
- 不要求改成 React / Vue / Three.js。
- 不要求多人联网。

