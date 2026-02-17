#!/usr/bin/env node
/**
 * skillforge CLI — route user input to skills and execute.
 *
 * Commands:
 *   skillforge run <prompt>         Route and execute a skill
 *   skillforge list [--dir <path>]  List registered skills
 *   skillforge info <name>          Show skill details
 */

import { resolve } from 'node:path'
import { SkillRuntime } from './runtime.js'
import { loadSkillsFromDir } from './markdown-loader.js'

const DEFAULT_SKILLS_DIR = './skills'

function usage(): void {
  console.log(`skillforge — route user input to skills

Usage:
  skillforge run <prompt>           Route and execute a skill
  skillforge list [--dir <path>]    List all available skills
  skillforge info <name>            Show skill details

Options:
  --dir <path>    Skills directory (default: ./skills)
  --help          Show this help message

Examples:
  skillforge run "what time is it"
  skillforge list --dir /path/to/skills
  skillforge info git-helper`)
}

async function main(): Promise<void> {
  const args = process.argv.slice(2)

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    usage()
    process.exit(0)
  }

  const command = args[0]
  const dirIdx = args.indexOf('--dir')
  const skillsDir = dirIdx !== -1 && args[dirIdx + 1]
    ? resolve(args[dirIdx + 1])
    : resolve(DEFAULT_SKILLS_DIR)

  // Load skills from directory
  let skills
  try {
    skills = await loadSkillsFromDir(skillsDir)
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
      const prompt = args
        .slice(1)
        .filter((a) => a !== '--dir' && a !== skillsDir)
        .join(' ')

      if (!prompt) {
        console.error('Error: missing prompt. Usage: skillforge run <prompt>')
        process.exit(1)
      }

      console.log(`[${skills.length} skills loaded from ${skillsDir}]`)
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
      const name = args[1]
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
      if (skill.engine) console.log(`Engine:      ${skill.engine}`)
      if (skill.keywords) console.log(`Keywords:    ${skill.keywords.join(', ')}`)
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
