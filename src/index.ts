// SkillForge — public API

// Types
export type {
  SkillDefinition,
  SkillContext,
  SkillResult,
  RouteMatch,
} from './types.js'

// Skill authoring
export { defineSkill, executeWithTiming } from './skill.js'

// Registry
export { SkillRegistry } from './registry.js'

// Router
export { scoreSkill, route, routeBest } from './router.js'

// Runtime (main entry point)
export { SkillRuntime } from './runtime.js'

// Markdown loader (SKILL.md format, compatible with clawdbot/OpenClaw)
export {
  loadSkillFromMarkdown,
  loadSkillsFromDir,
  parseSkillMarkdown,
  parseFrontmatter,
} from './markdown-loader.js'
export type {
  SkillFrontmatter,
  ParsedSkillMarkdown,
  LoadSkillOptions,
} from './markdown-loader.js'

// HTTP API server
export { startServer } from './server.js'
export type { ServeOptions } from './server.js'
