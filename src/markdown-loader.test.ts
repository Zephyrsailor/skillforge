import { describe, it, expect } from 'vitest'
import { join } from 'node:path'
import {
  parseFrontmatter,
  loadSkillFromMarkdown,
  loadSkillsFromDir,
} from './markdown-loader.js'

const SKILLS_DIR = join(import.meta.dirname, '..', 'skills')

describe('parseFrontmatter', () => {
  it('parses valid frontmatter + body', () => {
    const content = `---
name: test-skill
description: A test skill
metadata:
  skillforge:
    tags: [dev, test]
---

You are a test skill. Do test things.
`
    const result = parseFrontmatter(content, 'test.md')
    expect(result.frontmatter.name).toBe('test-skill')
    expect(result.frontmatter.description).toBe('A test skill')
    expect(result.frontmatter.metadata?.skillforge?.tags).toEqual([
      'dev',
      'test',
    ])
    expect(result.body).toBe('You are a test skill. Do test things.')
  })

  it('throws for missing frontmatter delimiters', () => {
    expect(() => parseFrontmatter('no frontmatter here', 'bad.md')).toThrow(
      'No valid YAML frontmatter',
    )
  })

  it('throws for missing name', () => {
    const content = `---
description: no name
---
body
`
    expect(() => parseFrontmatter(content, 'no-name.md')).toThrow(
      'Missing "name"',
    )
  })

  it('throws for missing description', () => {
    const content = `---
name: no-desc
---
body
`
    expect(() => parseFrontmatter(content, 'no-desc.md')).toThrow(
      'Missing "description"',
    )
  })

  it('falls back to line parser for unquoted colons in description', () => {
    // This mimics clawdbot skills with long descriptions containing colons
    const content = `---
name: discord
description: Control Discord from OpenClaw: send messages, react, manage threads.
metadata: {"openclaw":{"emoji":"🎮","requires":{"config":["channels.discord"]}}}
---

Discord instructions here.
`
    const result = parseFrontmatter(content, 'discord.md')
    expect(result.frontmatter.name).toBe('discord')
    expect(result.frontmatter.description).toContain('Discord')
    expect(result.frontmatter.metadata?.openclaw?.emoji).toBe('🎮')
    expect(result.body).toBe('Discord instructions here.')
  })

  it('parses openclaw metadata namespace', () => {
    const content = `---
name: weather
description: Get weather forecasts.
metadata: {"openclaw":{"emoji":"🌤️","requires":{"bins":["curl"]}}}
---

Weather body.
`
    const result = parseFrontmatter(content, 'weather.md')
    expect(result.frontmatter.metadata?.openclaw?.emoji).toBe('🌤️')
    expect(result.frontmatter.metadata?.openclaw?.requires?.bins).toEqual(['curl'])
  })

  it('handles multiline description', () => {
    const content = `---
name: multi
description: >
  This is a multiline
  description that spans
  multiple lines.
---
body here
`
    const result = parseFrontmatter(content, 'multi.md')
    expect(result.frontmatter.description).toContain('multiline')
    expect(result.frontmatter.description).toContain('multiple lines')
  })
})

describe('loadSkillFromMarkdown', () => {
  it('loads the git-helper SKILL.md from disk', async () => {
    const skillPath = join(SKILLS_DIR, 'git-helper', 'SKILL.md')
    const skill = await loadSkillFromMarkdown(skillPath)

    expect(skill.name).toBe('git-helper')
    expect(skill.description).toContain('git operations')
    expect(skill.tags).toEqual(['dev-tools', 'git', 'vcs'])

    // execute() returns the body (instructions)
    const result = await skill.execute({
      input: 'help with git',
      rawInput: 'help with git',
    })
    expect(result.output).toContain('You are a git expert')
    expect(result.skillName).toBe('git-helper')
  })
})

describe('loadSkillsFromDir', () => {
  it('loads all skills from the skills/ directory', async () => {
    const skills = await loadSkillsFromDir(SKILLS_DIR)

    // git-helper has a SKILL.md, hello-world is an empty dir
    expect(skills.length).toBeGreaterThanOrEqual(1)

    const names = skills.map((s) => s.name)
    expect(names).toContain('git-helper')
  })

  it('skips directories without SKILL.md', async () => {
    const skills = await loadSkillsFromDir(SKILLS_DIR)
    const names = skills.map((s) => s.name)
    // hello-world has no SKILL.md, should not appear
    expect(names).not.toContain('hello-world')
  })
})
