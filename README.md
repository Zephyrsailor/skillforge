# SkillForge

**A pluggable, open framework for integrating CLI AI agents and sharing skills.**

> Route any user prompt to the right skill, execute it via any AI backend. Everything can be a skill.

---

## Quick Demo

```bash
# List all available skills (loads from any SKILL.md directory)
skillforge list --dir ~/clawdbot/skills
# Total: 51 skills loaded

# Route a prompt to the best skill (returns skill instructions)
skillforge run --dir ~/clawdbot/skills "help me with github PR"
# → Skill: github (0ms)
# → [GitHub skill instructions: gh pr, gh issue, gh api usage...]

# Route + execute via Claude Code
skillforge run --dir ~/clawdbot/skills --engine claude-code "what's the weather in Shanghai"
# → Skill: weather
# → Claude Code executes with skill body as system prompt
# → Output: actual weather result from wttr.in

# Start an HTTP API server
skillforge serve --dir ~/clawdbot/skills --port 3000
# → POST /run { "prompt": "send a slack message" } → routes to slack skill
```

---

## What is SkillForge?

SkillForge is an open-source framework that:

1. **Routes user intent to skills** -- given a prompt, finds the best skill using TF-IDF-weighted keyword matching + name/tag/description scoring.
2. **Loads skills from Markdown** -- skills are `SKILL.md` files with YAML frontmatter. Compatible with OpenClaw/clawdbot format (51/52 skills load out of the box).
3. **Executes via any AI backend** -- with `--engine claude-code`, the skill body becomes a system prompt and gets executed by Claude Code via [agent-runner](https://github.com/Zephyrsailor/agent-runner).

---

## How It Works

```
User: "what's the weather in Shanghai?"
  |
  v
[Router] TF-IDF scoring across 51 skills
  |
  v
[weather skill] matched (score: 23.9)
  |
  +-- engine=direct  --> return SKILL.md body (instructions)
  |
  +-- engine=claude-code --> agent-runner spawns Claude Code
                             systemPrompt = SKILL.md body
                             prompt = "what's the weather in Shanghai?"
                             --> Claude Code runs curl wttr.in
                             --> returns actual weather data
```

---

## Installation

```bash
npm install skillforge
```

Or use directly with bun/tsx:

```bash
bun src/cli.ts run --dir ./skills "your prompt here"
```

---

## CLI Usage

```bash
# Route and execute a skill
skillforge run <prompt>
skillforge run --dir <path> --engine <engine> <prompt>

# List all available skills
skillforge list [--dir <path>]

# Show skill details
skillforge info <name> [--dir <path>]

# Start HTTP API server
skillforge serve [--dir <path>] [--port <port>] [--engine <engine>]
```

### Options

| Flag | Default | Description |
|------|---------|-------------|
| `--dir <path>` | `./skills` | Skills directory (scans for `*/SKILL.md`) |
| `--engine <engine>` | `direct` | `direct`, `claude-code`, or `codex` |
| `--port <port>` | `3000` | HTTP server port (serve mode) |

---

## Skill Format

A skill is a directory containing `SKILL.md`:

```
skills/weather/
  SKILL.md     # required: YAML frontmatter + Markdown instructions
```

```markdown
---
name: weather
description: Get current weather and forecasts (no API key required).
metadata: {"openclaw":{"emoji":"...","requires":{"bins":["curl"]}}}
---

# Weather

Two free services, no API keys needed.

## wttr.in (primary)

curl -s "wttr.in/London?format=3"
```

The YAML frontmatter provides routing metadata (name, description, tags). The Markdown body is the skill's instructions -- used as-is in direct mode, or as system prompt when executed via an AI agent.

---

## Programmatic API

```typescript
import { SkillRuntime, defineSkill, loadSkillsFromDir } from 'skillforge'

// Option 1: Define skills in TypeScript
const mySkill = defineSkill({
  name: 'greeting',
  description: 'Responds to greetings',
  keywords: ['hello', 'hi', 'hey'],
  async execute(ctx) {
    return { output: `Hello! You said: ${ctx.rawInput}`, skillName: 'greeting', durationMs: 0 }
  }
})

// Option 2: Load skills from SKILL.md files
const mdSkills = await loadSkillsFromDir('./skills', { engine: 'claude-code' })

// Create runtime and register
const runtime = new SkillRuntime()
runtime.register(mySkill)
for (const s of mdSkills) runtime.register(s)

// Route and execute
const result = await runtime.handle('hello there')
console.log(result?.output)  // "Hello! You said: hello there"
```

---

## HTTP API (serve mode)

```bash
skillforge serve --dir ~/clawdbot/skills --port 3000
```

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/skills` | List all loaded skills |
| `GET` | `/skills/:name` | Get skill details |
| `POST` | `/run` | Route and execute a prompt |

### GET /skills

```bash
curl http://localhost:3000/skills
```

```json
{
  "skills": [
    { "name": "github", "description": "Interact with GitHub using the `gh` CLI...", "tags": [], "engine": "direct" },
    { "name": "weather", "description": "Get current weather and forecasts...", "tags": [], "engine": "direct" },
    { "name": "discord", "description": "Manage Discord bots and servers...", "tags": [], "engine": "direct" }
  ],
  "total": 51
}
```

### POST /run

```bash
curl -X POST http://localhost:3000/run \
  -H 'Content-Type: application/json' \
  -d '{"prompt": "help me with github PR"}'
```

```json
{
  "skillName": "github",
  "output": "# GitHub Skill\n\nUse the `gh` CLI to interact with GitHub...\n\n## Pull Requests\n\nCheck CI status on a PR:\n\n```bash\ngh pr checks 55 --repo owner/repo\n```\n...",
  "durationMs": 0
}
```

### GET /skills/:name

```bash
curl http://localhost:3000/skills/weather
```

```json
{
  "name": "weather",
  "description": "Get current weather and forecasts (no API key required).",
  "tags": ["tools", "weather"],
  "keywords": [],
  "engine": "direct"
}
```

---

## Router

SkillForge uses a multi-phase scoring algorithm:

1. **Skill name match** (+20) -- exact name in input
2. **Keyword match** (+10 each) -- word-boundary for single words, substring for phrases
3. **Tag match** (+5 each) -- word-boundary matching
4. **Description relevance** (IDF-weighted) -- TF-IDF scoring with stop word filtering and fuzzy prefix matching

For 50+ skills this achieves high routing accuracy without any ML model or embedding.

---

## Roadmap

- [x] Core runtime: registry, router, skill execution
- [x] SKILL.md loader (compatible with OpenClaw/clawdbot)
- [x] CLI: `run`, `list`, `info`, `serve`
- [x] Agent-runner integration (Claude Code, Codex)
- [x] TF-IDF router with name/keyword/tag/description scoring
- [x] HTTP API server mode
- [ ] Skill registry (publish/install from remote)
- [ ] Vector-based semantic routing (phase 2)
- [ ] Plugin system with lifecycle hooks
- [ ] Skill marketplace UI

---

## Contributing

See [DESIGN.md](./DESIGN.md) for architecture details and [FEASIBILITY.md](./FEASIBILITY.md) for the "everything can be a skill" analysis.

---

## License

MIT
