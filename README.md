# SkillForge

**A pluggable, open framework for integrating CLI AI agents and sharing skills.**

> 可插拔的开源框架，用于集成 CLI AI 工具（Claude Code、Codex、Gemini CLI 等）并构建可共享的 skill 生态。

---

## What is SkillForge?

SkillForge is an open-source framework that:

1. **Abstracts CLI AI agent integration** — run Claude Code, OpenAI Codex, Gemini CLI, or any ACP-compatible agent behind a unified interface.
2. **Provides a portable skill system** — skills are Markdown files (`SKILL.md` + YAML frontmatter) that encode expert knowledge as reusable, composable AI capabilities.
3. **Enables a skill marketplace** — publish, discover, and install skills from a registry, just like npm packages.

---

## 它解决什么问题？

现有 AI CLI 工具（Claude Code、Codex、Cursor 等）各自为政：
- 集成方式不统一（有的用 spawn，有的用 HTTP，有的用 ACP 协议）
- Skill/Plugin 格式互不兼容
- 没有统一的发现和共享机制

SkillForge 提供统一抽象层，让你：
- 用同一套 API 驱动任意 CLI AI 后端
- 用同一种格式编写 skill，在不同 agent 之间复用
- 通过 registry 分享和安装 skill

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    SkillForge Core                       │
│                                                          │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │ Skill Loader │  │ Plugin System│  │  Event Bus    │  │
│  │ (discovery, │  │ (register,   │  │  (hooks,      │  │
│  │  routing,   │  │  load, jiti) │  │   lifecycle)  │  │
│  │  injection) │  └──────────────┘  └───────────────┘  │
│  └─────────────┘                                         │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │                  Runner Layer                     │   │
│  │  spawn() │ embedded SDK │ ACP ndjson │ HTTP/WS   │   │
│  └──────────────────────────────────────────────────┘   │
└───────────────────────┬─────────────────────────────────┘
                        │
        ┌───────────────┼───────────────┐
        ▼               ▼               ▼
  ┌──────────┐   ┌──────────┐   ┌──────────────┐
  │claude-   │   │  codex   │   │ gemini-cli   │
  │code      │   │ adapter  │   │   adapter    │
  │ adapter  │   └──────────┘   └──────────────┘
  └──────────┘
```

---

## Skill Format

A skill is a directory containing `SKILL.md`:

```
skills/my-skill/
├── SKILL.md          # required: frontmatter + instructions
├── scripts/          # optional: executable helpers
├── references/       # optional: lazy-loaded reference docs
└── assets/           # optional: templates, outputs
```

`SKILL.md` example:

```markdown
---
name: git-helper
description: >
  Helps with git operations: branching, rebasing, conflict resolution,
  cherry-pick, bisect. Use when the user asks about git workflows.
metadata:
  skillforge:
    tags: [dev-tools, git, vcs]
    requires:
      bins: [git]
    install:
      - type: brew
        package: git
user-invocable: true
---

You are a git expert. When helping with git operations...
```

---

## CLI Integration Patterns

SkillForge abstracts 5 integration patterns discovered from analyzing real-world CLI agents:

| Pattern | Mechanism | Use case |
|---------|-----------|----------|
| **CLI Spawn** | `child_process.spawn()` + stdin/stdout | Claude Code, Codex CLI |
| **Embedded SDK** | Direct SDK import, in-process | Anthropic API, OpenAI API |
| **ACP Protocol** | ndjson stream via stdin/stdout | ACP-compatible agents |
| **HTTP/SSE** | REST + streaming responses | Remote agents, Gemini |
| **Plugin (jiti)** | Dynamic TS/JS module loading | Extensions, adapters |

---

## Getting Started

```bash
# Install
npm install -g skillforge

# Run with Claude Code backend
skillforge run --backend claude-code "Help me refactor this function"

# Install a skill from registry
skillforge skill install git-helper

# List available skills
skillforge skill list

# Publish your skill
skillforge skill publish ./my-skill/
```

---

## Plugin API

```typescript
import { definePlugin } from 'skillforge/sdk'

export default definePlugin({
  id: 'my-plugin',
  name: 'My Plugin',
  version: '1.0.0',
  register(api) {
    api.registerSkill('./skills/my-skill')
    api.registerTool({
      name: 'my_tool',
      description: 'Does something useful',
      schema: { type: 'object', properties: { input: { type: 'string' } } },
      execute: async ({ input }) => ({ result: `processed: ${input}` })
    })
    api.registerHook('pre-run', async (ctx) => {
      // intercept before agent execution
    })
  }
})
```

---

## Skill Discovery & Routing (海量 Skill 场景)

For large skill ecosystems (1000+ skills), SkillForge uses a two-phase retrieval architecture:

```
User Intent
    │
    ▼
┌─────────────────────────────┐
│  Phase 1: Intent Classifier │  (tag/category filter, <10ms)
│  skill tags + BM25 index    │
└──────────────┬──────────────┘
               │ top-20 candidates
               ▼
┌─────────────────────────────┐
│  Phase 2: Semantic Ranker   │  (embedding similarity, ~50ms)
│  local vector index         │
│  (nomic-embed via ollama)   │
└──────────────┬──────────────┘
               │ top-3 skills
               ▼
         Context Injection
```

---

## Skill as a Communication Protocol

> Skill 作为能力的标准化接口

A skill published by Person A encodes their expertise as a reusable, structured capability module. When Person B installs and uses that skill, they effectively access Person A's expertise via AI mediation.

This creates an **async, standardized protocol for human capability transfer**:
- Publish a skill = standardize your expertise
- Install a skill = acquire that capability
- Skills are versioned, discoverable, and composable

Best suited to replace repetitive, encodable, operational human communication — not creative judgment or negotiation.

---

## Roadmap

- [ ] Core runner with Claude Code + Codex adapters
- [ ] Skill loader with 4-layer discovery (bundled → global → workspace → local)
- [ ] Plugin system with jiti dynamic loading
- [ ] Event bus with lifecycle hooks
- [ ] CLI: `skillforge run / skill install / skill publish`
- [ ] Local skill index + BM25 search
- [ ] Skill registry (HTTP API)
- [ ] Vector-based skill routing (phase 2 retrieval)
- [ ] Skill marketplace UI

---

## Contributing

See [DESIGN.md](./DESIGN.md) for architecture details and interface specifications.

---

## License

MIT
