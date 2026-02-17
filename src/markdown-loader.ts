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
  metadata?: {
    skillforge?: {
      tags?: string[]
      emoji?: string
      requires?: {
        bins?: string[]
        anyBins?: string[]
        env?: string[]
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
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    throw new Error(`Invalid YAML frontmatter in ${filePath}: ${msg}`)
  }

  if (!frontmatter.name) {
    throw new Error(`Missing "name" in frontmatter of ${filePath}`)
  }
  if (!frontmatter.description) {
    throw new Error(`Missing "description" in frontmatter of ${filePath}`)
  }

  return { frontmatter, body, filePath }
}

// ---------------------------------------------------------------------------
// Skill construction from parsed markdown
// ---------------------------------------------------------------------------

/**
 * Convert a parsed SKILL.md into a SkillDefinition.
 *
 * The execute() function returns the skill's body (instructions) as the output.
 * This is the simplest mode: the body serves as context/instructions for an
 * AI agent, or as direct textual output.
 *
 * For skills that need agent-runner execution, set `engine` in the frontmatter
 * or override after loading.
 */
function markdownToSkill(parsed: ParsedSkillMarkdown): SkillDefinition {
  const { frontmatter, body } = parsed
  const tags = frontmatter.metadata?.skillforge?.tags

  return {
    name: frontmatter.name,
    description: frontmatter.description,
    tags,
    execute: async (
      _ctx: SkillContext,
    ): Promise<SkillResult> => {
      return {
        output: body,
        skillName: frontmatter.name,
        durationMs: 0,
      }
    },
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Load a single skill from a SKILL.md file.
 */
export async function loadSkillFromMarkdown(
  filePath: string,
): Promise<SkillDefinition> {
  const absPath = resolve(filePath)
  const content = await readFile(absPath, 'utf-8')
  const parsed = parseFrontmatter(content, absPath)
  return markdownToSkill(parsed)
}

/**
 * Load all skills from a directory.
 * Scans for SKILL.md files in immediate subdirectories:
 *   dirPath/
 *     skill-a/SKILL.md
 *     skill-b/SKILL.md
 */
export async function loadSkillsFromDir(
  dirPath: string,
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
        const skill = await loadSkillFromMarkdown(skillFile)
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
