# SkillForge — Architecture & Interface Design

> 架构设计文档 v0.1（基于对 OpenClaw/clawdbot、Claude Code、OpenAI Agents SDK、LangChain 的系统研究）

---

## 1. Design Principles

1. **Declarative first** — skills 和 plugins 优先用 Markdown + YAML 定义，无需代码即可发布基础能力
2. **Layered scoping** — 优先级链：managed > local > workspace > user > bundled，后者覆盖前者
3. **Progressive complexity** — 简单 skill 只需一个 `.md` 文件；复杂插件可用完整 TypeScript API
4. **Backend agnostic** — runner 层屏蔽底层 CLI 差异，上层代码不感知具体 AI agent
5. **Lazy everything** — skill metadata 常驻内存，body/scripts/references 按需加载

---

## 2. Module Structure

```
packages/
  core/          # Runtime core: runner, skill loader, plugin system, event bus
  cli/           # CLI entry: skillforge run / skill / plugin / config
  sdk/           # Plugin/skill authoring SDK (definePlugin, defineSkill, @tool)

adapters/
  claude-code/   # Claude Code CLI adapter (spawn + stdin/stdout)
  codex/         # OpenAI Codex CLI adapter
  gemini-cli/    # Gemini CLI adapter (HTTP/SSE)
  acp/           # ACP protocol adapter (ndjson stream)

skills/          # Bundled example skills
```

---

## 3. Core Interfaces

### 3.1 Runner Layer

```typescript
// packages/core/src/runner/types.ts

export interface BackendConfig {
  id: string                    // e.g. "claude-code", "codex"
  command: string               // executable name
  args?: string[]               // base args
  inputMode: 'arg' | 'stdin'   // how to pass the prompt
  outputMode: 'text' | 'json' | 'jsonl'
  sessionFlag?: string          // e.g. "--resume"
  modelFlag?: string            // e.g. "--model"
  systemPromptFlag?: string
  capabilities: {
    streaming: boolean
    toolUse: boolean
    sessions: boolean
  }
}

export interface RunOptions {
  prompt: string
  sessionId?: string
  model?: string
  systemPrompt?: string
  skills?: SkillSnapshot
  tools?: ToolDefinition[]
  signal?: AbortSignal
}

export interface RunResult {
  text: string
  payloads: OutputPayload[]
  meta: {
    durationMs: number
    usage?: { inputTokens: number; outputTokens: number }
    sessionId?: string
  }
}

export interface Runner {
  run(options: RunOptions): Promise<RunResult>
  stream?(options: RunOptions): AsyncIterable<OutputPayload>
}
```

### 3.2 Skill System

```typescript
// packages/core/src/skill/types.ts

export interface SkillFrontmatter {
  name: string                  // unique key
  description: string           // intent description, used for routing
  metadata?: {
    skillforge?: SkillForgeMetadata
    [namespace: string]: unknown
  }
  'user-invocable'?: boolean
  'disable-model-invocation'?: boolean
  'command-dispatch'?: 'tool' | 'agent'
  'command-tool'?: string
}

export interface SkillForgeMetadata {
  tags?: string[]               // for discovery/filtering
  emoji?: string
  homepage?: string
  skillKey?: string
  primaryEnv?: string
  os?: NodeJS.Platform[]
  always?: boolean              // always inject into context
  requires?: {
    bins?: string[]
    anyBins?: string[]
    env?: string[]
    config?: string[]
  }
  install?: InstallSpec[]
}

export interface InstallSpec {
  type: 'brew' | 'npm' | 'go' | 'uv' | 'download'
  package?: string
  url?: string
  binary?: string
}

export interface SkillEntry {
  name: string
  description: string
  filePath: string
  baseDir: string
  frontmatter: SkillFrontmatter
  source: 'bundled' | 'managed' | 'workspace' | 'plugin' | 'extra'
  metadata?: SkillForgeMetadata
}

export interface SkillSnapshot {
  skills: SkillEntry[]          // all eligible skills
  prompt: string                // formatted prompt injection
  version: number               // bumps on file changes (via watcher)
}
```

### 3.3 Plugin System

```typescript
// packages/core/src/plugin/types.ts

export interface PluginApi {
  // Skills
  registerSkill(dirPath: string): void
  registerSkillDir(dirPath: string): void

  // Tools
  registerTool(tool: ToolDefinition): void

  // Hooks (lifecycle events)
  registerHook<E extends HookEvent>(
    event: E,
    handler: HookHandler<E>,
    options?: { matcher?: RegExp | string; priority?: number }
  ): void

  // Adapters / Backends
  registerBackend(config: BackendConfig, runner: RunnerFactory): void

  // HTTP endpoints
  registerHttpHandler(path: string, handler: HttpHandler): void

  // Services (dependency injection)
  registerService<T>(token: ServiceToken<T>, impl: T): void

  // Config schema
  registerConfigSchema(schema: JsonSchema): void
}

export interface PluginDefinition {
  id: string
  name: string
  description?: string
  version: string
  kind?: 'memory' | 'channel' | 'backend' | 'skill-pack' | 'tool-pack'
  configSchema?: JsonSchema
  register(api: PluginApi): void | Promise<void>
}

// Authoring helper
export function definePlugin(def: PluginDefinition): PluginDefinition {
  return def
}
```

### 3.4 Event Bus (Hooks)

```typescript
// packages/core/src/event-bus/types.ts

export type HookEvent =
  | 'session:start'
  | 'session:stop'
  | 'prompt:submit'           // before sending to backend
  | 'prompt:response'         // after receiving response
  | 'tool:pre-use'            // before tool execution
  | 'tool:post-use'           // after tool execution
  | 'skill:load'              // when a skill is loaded
  | 'skill:invoke'            // when a skill is invoked
  | 'backend:pre-run'         // before spawning CLI/SDK
  | 'backend:post-run'        // after run completes
  | 'error'

export type HookResult =
  | { action: 'allow' }
  | { action: 'deny'; reason: string }
  | { action: 'modify'; payload: unknown }

export type HookHandler<E extends HookEvent> = (
  ctx: HookContext<E>
) => HookResult | void | Promise<HookResult | void>
```

---

## 4. Skill Discovery & Routing

### 4.1 Directory Priority Chain (4 layers)

```
Priority (low → high):
  1. bundled      packages/core/skills/
  2. managed      ~/.skillforge/skills/
  3. workspace    {cwd}/skills/
  4. local        {cwd}/.skillforge/skills/   (gitignore'd overrides)

Plugin skills injected between bundled and managed.
Same-name skill: higher priority wins (overwrite map strategy).
```

### 4.2 Two-Phase Retrieval (for 1000+ skills)

```
Phase 1 — Tag Filter (< 5ms, in-memory)
  - skill.tags ∩ intent.detectedTags → candidate set (top ~20)
  - "always: true" skills always included
  - platform/requires eligibility filter

Phase 2 — Semantic Ranker (< 100ms, local)
  - embed user prompt with local model (nomic-embed-text / ollama)
  - cosine similarity against pre-computed skill description embeddings
  - stored in SQLite + sqlite-vec (zero external dependency)
  - return top-K (default K=5) for context injection

Fallback (no embedding model):
  - BM25 full-text search on name + description
  - implemented in-process, no external service required
```

### 4.3 Skill Index Schema

```sql
-- Local SQLite index (~/.skillforge/skill-index.db)
CREATE TABLE skills (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT NOT NULL,
  tags        TEXT,             -- JSON array
  source      TEXT,
  file_path   TEXT,
  checksum    TEXT,             -- for change detection
  embedding   BLOB,             -- float32 array (sqlite-vec)
  updated_at  INTEGER
);
```

---

## 5. Skill as Communication Protocol

### 5.1 Capability Transfer Model

```
Person A (domain expert)
  │
  │ publish skill
  ▼
Skill Registry
  │
  │ install skill
  ▼
Person B + AI Agent
  │
  │ invoke capability
  ▼
Result (as if Person A did it)
```

A skill encodes:
- **What** the capability does (description, for routing)
- **How** to do it (body: instructions, best practices)
- **Requirements** (tools, APIs, environment)
- **Installation** (how to get the dependencies)

### 5.2 Skill Registry API (HTTP)

```
GET  /v1/skills                     list/search skills
GET  /v1/skills/:name               get skill metadata
GET  /v1/skills/:name/:version      download skill tarball
POST /v1/skills                     publish skill (auth required)
PUT  /v1/skills/:name/:version      update skill
GET  /v1/skills/:name/versions      list versions
GET  /v1/tags                       list all tags
```

### 5.3 Trust & Permission Model

```
Level 0 — Pure Markdown instructions (safest, no install required)
Level 1 — Markdown + reference docs
Level 2 — Includes scripts/ (user confirmation required)
Level 3 — Requires external tool installation (confirmation + sandbox)

Trust signals:
  - Publisher identity (GitHub OAuth)
  - Community rating + download count
  - Code review for Level 2/3 skills
  - Signature verification (future)
```

---

## 6. CLI Interface Design

```bash
# Run with a backend
skillforge run [--backend <id>] [--model <model>] "<prompt>"
skillforge run --backend claude-code "refactor this file"

# Skill management
skillforge skill list [--tags dev-tools] [--installed]
skillforge skill info <name>
skillforge skill install <name>[@version]
skillforge skill uninstall <name>
skillforge skill publish <dir>
skillforge skill create <name>       # scaffold a new skill

# Plugin management
skillforge plugin list
skillforge plugin install <package>
skillforge plugin uninstall <package>

# Backend management
skillforge backend list
skillforge backend test <id>

# Config
skillforge config set backend.default claude-code
skillforge config get

# Index management
skillforge index rebuild              # rebuild local skill index
skillforge index stats
```

---

## 7. Comparison with Existing Systems

| Feature | SkillForge | Claude Code Skills | OpenAI Agents | LangChain |
|---------|------------|-------------------|---------------|-----------|
| Backend agnostic | ✓ | ✗ (Claude only) | ✗ (OpenAI only) | ✓ |
| Declarative format | ✓ (YAML+MD) | ✓ | ✗ (Python) | ✗ (Python) |
| Skill marketplace | ✓ (planned) | ✗ | ✗ | ✓ (integrations) |
| Semantic routing | ✓ (2-phase) | ✗ (all injected) | ✗ | ✗ |
| Plugin system | ✓ | ✓ | ✗ | ✓ |
| CLI first | ✓ | ✓ | ✗ | ✗ |
| Version management | ✓ | ✗ | ✗ | ✗ |
| Open source | ✓ | ✗ | ✗ | ✓ |

---

## 8. Research Sources

- OpenClaw/clawdbot source: `src/agents/`, `src/plugins/`, `src/acp/`, `src/process/`
- Claude Code hooks docs: https://docs.anthropic.com/en/docs/claude-code/hooks
- Claude Code sub-agents: https://docs.anthropic.com/en/docs/claude-code/sub-agents
- OpenAI Agents SDK: https://openai.github.io/openai-agents-python/
- LangChain Tools: https://python.langchain.com/docs/concepts/tools/

Screenshots in: `research/screenshots/`
