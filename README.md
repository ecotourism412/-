# 保卫白菜

《保卫白菜》是一款静态网页上的模拟 3D Canvas 射击游戏，也是一款把 AI 角色对白接进玩法节奏里的 AI 小游戏。游戏本体仍由固定规则驱动，AI 只负责角色说话、聊天和语音表达。

## 玩家任务

你要保护一个话很多的小白菜。它可能有点吵，甚至有点讨厌，但你还是得守住菜地，打败冲过来的机器小猪和猪王，不要让猪王拱到白菜。

## AI 功能

- 小白菜、机器小猪和猪王会根据战斗事件生成短对白，并显示在游戏里。
- 玩家可以按空格打开小白菜聊天框，直接用文字和它对话。
- 聊天或关键战斗对白会触发 TTS，让小白菜、猪王或小猪把台词读出来。
- Boss 入场、半血、低血和失败时会触发猪王与小白菜的对峙对白。
- 玩家可以在聊天里引导小白菜嘲讽猪王；如果场景合适，猪王也会回嘴。

## Implementation Log

- 新增 `AGENTS.md`，明确项目边界、目录职责、AI 对白规则和验证要求。
- 这样后续 agent 在改代码前能先读取统一规则，避免把 AI 逻辑混进战斗核心。
- 新增 AI snapshot、scheduler 和本地 fallback，对白改为事件驱动的统一本地管线。
- 预留 `.env.example` 推理时代接口占位，不读取、不请求、不暴露真实 API Key。
- 新增 server AI handler、角色 prompt、角色路由和 response validator 骨架，为后续接外部模型预留边界。
- 新增前端 `aiClient`，默认关闭远程 AI，继续使用本地 fallback，避免后端不可用影响游戏。
- 接入推理时代 / AIHubMix OpenAI-compatible 语言模型调用，API Key 仅由 server 读取。
- 新增 `.env` 占位、Netlify `/api/ai-reaction` 路由和远程失败 fallback，保证静态环境仍能正常显示本地对白。
- AIHubMix `/v1/models` 当前可见 `glm-4.7-flash-free`，未列出 `Doubao-1.5-lite-32k` / `Doubao-1.5-pro-32k`，因此需要使用可用替代模型。
- 深测发现本机 Node 到 AIHubMix 超时、`glm-4.7-flash-free` 只返回 reasoning 内容，且豆包替代模型延迟偏高；三角色暂改 `qwen3.6-flash` 并关闭 thinking，保留失败 fallback。
- 新增白菜精灵局内跟随实体、方块模型、跳跃眨眼表情和头顶对白气泡。
- 白菜仍不参与命中、伤害、波次或胜负，只把陪伴角色从 HUD 文本变成可见友方单位。
- 阅读豆包语音双向流式 TTS WebSocket 文档，新增 `/api/tts` serverless 骨架和前端异步播放入口。
- TTS API Key 与音色 ID 仅放在后端 `.env` 占位，缺配置时静默跳过语音，不影响文字对白和游戏流程。
- 新增本地 Node 服务，同时托管网页和 `/api/ai-reaction`、`/api/tts`，本地测试不再依赖纯静态服务器。
- 改为项目内原生 WebSocket 客户端连接豆包 TTS，不再依赖损坏的本机 npm 安装 `ws`。
- 新增本地 voice policy，模型只决定对白文本，是否出声由游戏侧调度。
- 修正豆包 TTS 双向 WebSocket 的 StartSession / TaskRequest payload 和音频帧识别，真实返回 mp3 音频。
- 新增 AIHubMix 本地 Python HTTP 兜底，解决当前机器 Node fetch 到 AIHubMix 超时但 Python 可访问的问题。
- 提高角色模型 `maxTokens`，避免完整 JSON 被截断；对白字数仍由 validator 限制。
- 升级 AI 对白为 `intent` / `emotion` / `text` 结构，保留风格示例但禁止照抄，并增加最近对白避重。
- 新增小白菜右侧聊天面板和 `/api/ai-chat`，玩家可直接对话，回复同步进入聊天历史和头顶气泡。
- Boss 关键事件新增猪王与白菜的延迟双段对白，让关键节点更像角色对峙而不是单句播报。
- 将空格键从射击改为打开小白菜对话栏，避免聊天入口被藏在侧边按钮里。
- 聊天中的白菜回复强制请求一次白菜语音 TTS，战斗事件对白仍保留原有语音冷却策略。
- 修正画面底部操作提示，把空格说明改为打开对话框，避免和当前射击逻辑冲突。
- 提高普通猪对白和 TTS 可听见的机会，并在猪音色缺失时允许临时复用猪王音色，解决部署后只有白菜出声的问题。
- 撤回普通猪对白频率提升，改为修正 TTS 抢占策略：猪王语音优先级最高，普通猪可压过白菜，白菜事件语音冷却延长。
- 猪王或普通猪缺少专用音色时先复用可用音色保底出声，方便部署后先验证 TTS 链路。
- 将 TTS 从硬优先级改为每波语音配额，目标比例为白菜最多、猪王其次、普通猪最少。
- 给对白 bark 保留事件来源，让 Boss 入场、半血、死亡等关键句优先占用猪王语音槽。
- 在 README 顶部补充游戏简介、玩家任务和面向玩家的 AI 功能说明，方便公开试玩链接访问者快速理解玩法。

## Dependencies

- 当前无外部运行依赖；豆包 TTS WebSocket 使用项目内最小客户端实现。

## Local Run

- `npm start` 或 `node server/localServer.js`
- 打开 `http://localhost:8000/`
