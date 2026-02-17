/**
 * SKILL.md loader — parses Markdown skill files with YAML frontmatter.
 *
 * Compatible with the clawdbot/OpenClaw SKILL.md format:
 *   - YAML frontmatter between `---` delimiters
 *   - Remaining body is the skill's instructions/prompt
 *
 * This lets skillforge load existing OpenClaw skills directly.
 */

import { readFile, readdir, stat } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import yaml from 'js-yaml'
import type { SkillDefinition, SkillContext, SkillResult } from './types.js'

// ---------------------------------------------------------------------------
// Frontmatter types (mirrors clawdbot/OpenClaw format)
// ---------------------------------------------------------------------------

export interface SkillFrontmatter {
  name: string
  description: string
  homepage?: string
  metadata?: {
    skillforge?: {
      tags?: string[]
      emoji?: string
      requires?: {
        bins?: string[]
        anyBins?: string[]
        env?: string[]
        config?: string[]
      }
      install?: Array<{ type: string; package?: string }>
    }
    // clawdbot/OpenClaw uses "openclaw" namespace
    openclaw?: {
      tags?: string[]
      emoji?: string
      requires?: {
        bins?: string[]
        anyBins?: string[]
        env?: string[]
        config?: string[]
      }
      install?: Array<{ type: string; package?: string }>
    }
  }
  'user-invocable'?: boolean
  'disable-model-invocation'?: boolean
}

export interface ParsedSkillMarkdown {
  frontmatter: SkillFrontmatter
  body: string
  filePath: string
}

// ---------------------------------------------------------------------------
// Frontmatter parsing
// ---------------------------------------------------------------------------

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/

/**
 * Parse a SKILL.md file's raw content into frontmatter + body.
 */
export function parseFrontmatter(
  content: string,
  filePath: string,
): ParsedSkillMarkdown {
  const match = content.match(FRONTMATTER_RE)
  if (!match) {
    throw new Error(
      `No valid YAML frontmatter found in ${filePath}. ` +
        'Expected file to start with --- delimiters.',
    )
  }

  const rawYaml = match[1]
  const body = match[2].trim()

  let frontmatter: SkillFrontmatter
  try {
    frontmatter = yaml.load(rawYaml) as SkillFrontmatter
  } catch {
    // Fallback: simple line-based parser for files with unquoted colons
    // in description fields (common in clawdbot skills)
    frontmatter = parseFrontmatterFallback(rawYaml)
  }

  if (!frontmatter.name) {
    throw new Error(`Missing "name" in frontmatter of ${filePath}`)
  }
  if (!frontmatter.description) {
    throw new Error(`Missing "description" in frontmatter of ${filePath}`)
  }

  return { frontmatter, body, filePath }
}

/**
 * Fallback parser for frontmatter that js-yaml can't handle
 * (e.g. unquoted colons in description values).
 * Extracts top-level key: value pairs line by line.
 */
function parseFrontmatterFallback(rawYaml: string): SkillFrontmatter {
  const lines = rawYaml.split('\n')
  const result: Record<string, string> = {}
  let metadataRaw = ''
  let inMetadata = false

  for (const line of lines) {
    // Detect top-level key (no leading whitespace, has colon)
    const topMatch = line.match(/^(\w[\w-]*):\s*(.*)$/)
    if (topMatch) {
      const key = topMatch[1]
      const value = topMatch[2]

      if (key === 'metadata') {
        // metadata might be inline JSON or multi-line
        inMetadata = true
        metadataRaw = value
        continue
      }

      inMetadata = false
      result[key] = value
    } else if (inMetadata) {
      metadataRaw += line
    }
  }

  // Try to parse metadata as JSON (common in clawdbot: inline JSON)
  let metadata: SkillFrontmatter['metadata']
  if (metadataRaw.trim()) {
    try {
      metadata = JSON.parse(metadataRaw.trim())
    } catch {
      // Can't parse metadata, skip it
    }
  }

  return {
    name: result['name'] ?? '',
    description: result['description'] ?? '',
    homepage: result['homepage'],
    metadata,
    'user-invocable': result['user-invocable'] === 'true',
  }
}

// ---------------------------------------------------------------------------
// Load options
// ---------------------------------------------------------------------------

export interface LoadSkillOptions {
  /**
   * Override the execution engine for all loaded skills.
   * When set to 'claude-code' or 'codex', execute() will delegate to agent-runner
   * using the SKILL.md body as system prompt and the user input as the prompt.
   * When 'direct' (default), execute() returns the raw body text.
   */
  engine?: 'direct' | 'claude-code' | 'codex'
}

// ---------------------------------------------------------------------------
// Skill construction from parsed markdown
// ---------------------------------------------------------------------------

/**
 * Convert a parsed SKILL.md into a SkillDefinition.
 *
 * Behavior depends on the engine setting:
 * - 'direct' (default): execute() returns the skill's body (instructions) as text.
 *   The caller can use this as context for their own AI integration.
 * - 'claude-code' / 'codex': execute() delegates to agent-runner, passing the
 *   body as systemPrompt and the user's input as prompt.
 */
function markdownToSkill(
  parsed: ParsedSkillMarkdown,
  options?: LoadSkillOptions,
): SkillDefinition {
  const { frontmatter, body } = parsed
  const engine = options?.engine ?? 'direct'

  // Extract tags from skillforge or openclaw namespace (clawdbot compat)
  const tags =
    frontmatter.metadata?.skillforge?.tags ??
    frontmatter.metadata?.openclaw?.tags

  const skillName = frontmatter.name

  return {
    name: skillName,
    description: frontmatter.description,
    tags,
    engine,
    execute: async (
      ctx: SkillContext,
    ): Promise<SkillResult> => {
      // When engine is set, delegate to agent-runner
      if (engine && engine !== 'direct') {
        return executeViaAgent(skillName, body, ctx, engine)
      }

      // Default: return the SKILL.md body as instructions
      return {
        output: body,
        skillName,
        durationMs: 0,
      }
    },
  }
}

/**
 * Execute a SKILL.md skill via agent-runner.
 * Uses the skill body as system prompt and the user input as the agent prompt.
 */
async function executeViaAgent(
  skillName: string,
  body: string,
  ctx: SkillContext,
  engine: string,
): Promise<SkillResult> {
  const start = performance.now()

  try {
    // Try npm package first, fall back to local dev path
    let mod: {
      AgentRunner: new (config: {
        backend: string
      }) => {
        run(opts: {
          prompt: string
          systemPrompt?: string
          mode?: string
        }): Promise<{ text: string; durationMs: number }>
      }
    }
    try {
      mod = await import('@shurenwei/agent-runner')
    } catch {
      mod = await import('../../agent-runner/src/index.js')
    }

    const { AgentRunner } = mod
    const backend = engine === 'codex' ? 'codex' : 'claude-code'
    const runner = new AgentRunner({ backend })

    const result = await runner.run({
      prompt: ctx.rawInput,
      systemPrompt: body, // SKILL.md body as system prompt
      mode: 'print',
    })

    const durationMs = Math.round(performance.now() - start)
    return {
      output: result.text,
      skillName,
      durationMs,
    }
  } catch (err) {
    // agent-runner not available: return body + error note
    const durationMs = Math.round(performance.now() - start)
    const msg = err instanceof Error ? err.message : String(err)
    return {
      output: `[agent-runner unavailable: ${msg}]\n\nSkill instructions (${skillName}):\n\n${body}`,
      skillName,
      durationMs,
    }
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Load a single skill from a SKILL.md file.
 *
 * @param options.engine Override execution engine ('direct' | 'claude-code' | 'codex')
 */
export async function loadSkillFromMarkdown(
  filePath: string,
  options?: LoadSkillOptions,
): Promise<SkillDefinition> {
  const absPath = resolve(filePath)
  const content = await readFile(absPath, 'utf-8')
  const parsed = parseFrontmatter(content, absPath)
  return markdownToSkill(parsed, options)
}

/**
 * Load all skills from a directory.
 * Scans for SKILL.md files in immediate subdirectories:
 *   dirPath/
 *     skill-a/SKILL.md
 *     skill-b/SKILL.md
 *
 * @param options.engine Override execution engine for all loaded skills
 */
export async function loadSkillsFromDir(
  dirPath: string,
  options?: LoadSkillOptions,
): Promise<SkillDefinition[]> {
  const absDir = resolve(dirPath)
  const entries = await readdir(absDir, { withFileTypes: true })
  const skills: SkillDefinition[] = []

  for (const entry of entries) {
    if (!entry.isDirectory()) continue

    const skillFile = join(absDir, entry.name, 'SKILL.md')
    try {
      const fileStat = await stat(skillFile)
      if (fileStat.isFile()) {
        const skill = await loadSkillFromMarkdown(skillFile, options)
        skills.push(skill)
      }
    } catch {
      // No SKILL.md in this subdirectory, skip
    }
  }

  return skills
}

/**
 * Load a skill from a SKILL.md file and return the raw parsed data
 * (frontmatter + body) without converting to SkillDefinition.
 * Useful when you need access to the full frontmatter metadata.
 */
export async function parseSkillMarkdown(
  filePath: string,
): Promise<ParsedSkillMarkdown> {
  const absPath = resolve(filePath)
  const content = await readFile(absPath, 'utf-8')
  return parseFrontmatter(content, absPath)
}
