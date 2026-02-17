#!/usr/bin/env node
/**
 * skillforge CLI — route user input to skills and execute.
 *
 * Commands:
 *   skillforge run <prompt>         Route and execute a skill
 *   skillforge list [--dir <path>]  List registered skills
 *   skillforge info <name>          Show skill details
 *   skillforge serve [--port N]     Start HTTP API server
 */

import { resolve } from 'node:path'
import { SkillRuntime } from './runtime.js'
import { loadSkillsFromDir } from './markdown-loader.js'
import { startServer } from './server.js'
import type { LoadSkillOptions } from './markdown-loader.js'

const DEFAULT_SKILLS_DIR = './skills'
const VALID_ENGINES = ['direct', 'claude-code', 'codex'] as const

function usage(): void {
  console.log(`skillforge — route user input to skills

Usage:
  skillforge run <prompt>           Route and execute a skill
  skillforge list [--dir <path>]    List all available skills
  skillforge info <name>            Show skill details
  skillforge serve [--port <port>]  Start HTTP API server

Options:
  --dir <path>       Skills directory (default: ./skills)
  --engine <engine>  Execution engine: direct, claude-code, codex (default: direct)
  --port <port>      HTTP server port (default: 3000, serve mode only)
  --help             Show this help message

Examples:
  skillforge run "what time is it"
  skillforge run --dir ~/clawdbot/skills "what's the weather in Shanghai"
  skillforge run --dir ~/clawdbot/skills --engine claude-code "help me with git rebase"
  skillforge list --dir /path/to/skills
  skillforge info git-helper
  skillforge serve --dir ~/clawdbot/skills --port 3000`)
}

/** Extract a named flag's value from args, or undefined. */
function getFlag(args: string[], flag: string): string | undefined {
  const idx = args.indexOf(flag)
  if (idx !== -1 && args[idx + 1]) return args[idx + 1]
  return undefined
}

/** Remove flag + value pairs from args to get the remaining prompt. */
function stripFlags(args: string[], flags: string[]): string[] {
  const result: string[] = []
  let i = 0
  while (i < args.length) {
    if (flags.includes(args[i]) && args[i + 1]) {
      i += 2 // skip flag + value
    } else {
      result.push(args[i])
      i++
    }
  }
  return result
}

async function main(): Promise<void> {
  const args = process.argv.slice(2)

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    usage()
    process.exit(0)
  }

  const command = args[0]
  const restArgs = args.slice(1)

  const skillsDir = resolve(getFlag(restArgs, '--dir') ?? DEFAULT_SKILLS_DIR)
  const engineArg = getFlag(restArgs, '--engine') ?? 'direct'

  if (!VALID_ENGINES.includes(engineArg as typeof VALID_ENGINES[number])) {
    console.error(`Invalid engine: ${engineArg}`)
    console.error(`Valid engines: ${VALID_ENGINES.join(', ')}`)
    process.exit(1)
  }

  const engine = engineArg as LoadSkillOptions['engine']

  // Load skills from directory
  let skills
  try {
    skills = await loadSkillsFromDir(skillsDir, { engine })
  } catch {
    console.error(`Failed to load skills from: ${skillsDir}`)
    console.error('Use --dir to specify a valid skills directory.')
    process.exit(1)
  }

  const runtime = new SkillRuntime()
  for (const skill of skills) {
    runtime.register(skill)
  }

  switch (command) {
    case 'run': {
      const promptParts = stripFlags(restArgs, ['--dir', '--engine'])
      const prompt = promptParts.join(' ')

      if (!prompt) {
        console.error('Error: missing prompt. Usage: skillforge run <prompt>')
        process.exit(1)
      }

      const engineLabel = engine === 'direct' ? 'direct (returns instructions)' : engine
      console.log(`[${skills.length} skills loaded | engine: ${engineLabel}]`)
      console.log()

      const result = await runtime.handle(prompt)
      if (result) {
        console.log(`Skill: ${result.skillName} (${result.durationMs}ms)`)
        console.log()
        console.log(result.output)
      } else {
        console.log('No matching skill found for this input.')
        console.log('Available skills:')
        for (const s of runtime.registry.list()) {
          console.log(`  - ${s.name}: ${s.description.slice(0, 60)}`)
        }
      }
      break
    }

    case 'list': {
      console.log(`Skills loaded from: ${skillsDir}`)
      console.log(`Engine: ${engine}`)
      console.log(`Total: ${skills.length}\n`)

      for (const s of skills) {
        const desc =
          s.description.length > 70
            ? s.description.slice(0, 70) + '...'
            : s.description
        const tags = s.tags ? ` [${s.tags.join(', ')}]` : ''
        console.log(`  ${s.name}: ${desc}${tags}`)
      }
      break
    }

    case 'info': {
      const infoParts = stripFlags(restArgs, ['--dir', '--engine'])
      const name = infoParts[0]
      if (!name) {
        console.error('Error: missing skill name. Usage: skillforge info <name>')
        process.exit(1)
      }

      const skill = runtime.registry.get(name)
      if (!skill) {
        console.error(`Skill "${name}" not found.`)
        console.error('Available skills:')
        for (const s of runtime.registry.list()) {
          console.log(`  - ${s.name}`)
        }
        process.exit(1)
      }

      console.log(`Name:        ${skill.name}`)
      console.log(`Description: ${skill.description}`)
      if (skill.tags) console.log(`Tags:        ${skill.tags.join(', ')}`)
      console.log(`Engine:      ${skill.engine ?? 'direct'}`)
      if (skill.keywords) console.log(`Keywords:    ${skill.keywords.join(', ')}`)
      break
    }

    case 'serve': {
      const port = parseInt(getFlag(restArgs, '--port') ?? '3000', 10)
      if (isNaN(port) || port < 1 || port > 65535) {
        console.error(`Invalid port: ${getFlag(restArgs, '--port')}`)
        process.exit(1)
      }
      startServer({ port, runtime })
      break
    }

    default:
      console.error(`Unknown command: ${command}`)
      usage()
      process.exit(1)
  }
}

main().catch((err) => {
  console.error(err.message || err)
  process.exit(1)
})
