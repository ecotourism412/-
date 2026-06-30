# AGENTS.md

## Project

This is a static Canvas pseudo-3D shooting game called **保卫白菜**.

AI only controls character dialogue. It must not control gameplay.

## Core Boundaries

Unless the current task explicitly asks for it, do not change movement, shooting, hit detection, damage, waves, Boss state machine, or win / lose logic.

## Directory Map

* `index.html`: browser entry.
* `src/main.js`: main ES module entry.
* root `main.js`: compatibility import only.
* `src/core`: game state, loop, UI, constants, helpers.
* `src/entities`: player, pigs, Boss state.
* `src/combat`: shooting, hit, damage, dodge, shockwave, particles.
* `src/waves`: wave and spawn flow.
* `src/render`: Canvas scene, HUD, dialogue drawing.
* `src/audio`: sound effects and BGM.
* `src/dialogue`: dialogue queue and bark display.
* `src/ai`: AI reaction pipeline and fallback dialogue.

## AI Dialogue Rules

AI dialogue must be event-driven.

Preferred flow:

```text
emitGameEvent(type, payload)
→ aiScheduler / getReaction
→ buildAISnapshot
→ fallback or model reaction
→ enqueueBark({ speaker, text, tone, priority, ttl })
```

Do not call AI every frame.

Do not put long prompts inside combat, render, wave, or entity logic.

One AI reaction should produce one character’s dialogue. Do not put cabbage, pig, and pigKing into one prompt unless explicitly requested.

Do not implement future features beyond the current task.

## Environment and Dependencies

Never put API keys in frontend code.

`.env.example` may contain placeholders only.

Use these placeholders if needed:

```text
TUJILISHIDAI_API_KEY=your_api_key_here
TUJILISHIDAI_BASE_URL=https://your-tuijilishidai-api-base-url-here
TUJILISHIDAI_MODEL=your_model_name_here
```

External dependencies are allowed only when they are necessary for the current task.

When adding a dependency, record in `README.md`:

* package name
* why it was added
* what problem it solves

Do not introduce a build system unless explicitly requested.

## Validation

When possible, run syntax checks on changed JavaScript files:

```bash
node --check <changed-js-file>
```

Also verify the game in a browser through a local static server when possible.

Browser behavior is the final check.

## README Log Rule

After each completed coding step, update `README.md` with a short Chinese implementation log.

The log must be written in Chinese.

Each entry should briefly say:

* 改了什么
* 为什么改
* 解决了什么问题

Keep it short: 1–3 bullets.

If `README.md` does not exist, create it.

If it already exists, do not rewrite the whole file. Append or update only a small `Implementation Log` section.

Do not update `AGENTS.md` unless project rules changed.

## Code Style

Keep changes small and safe.

Keep files focused and single-purpose.

Avoid hidden global state.

Prefer minimal edits over large rewrites.
