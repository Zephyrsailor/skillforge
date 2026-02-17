/**
 * Test loading real clawdbot/OpenClaw skills (52 skills).
 *
 * Run: bun examples/load-clawdbot-skills.ts
 */

import { loadSkillsFromDir } from '../src/index.js'

const CLAWDBOT_SKILLS_DIR =
  '/Users/zephyr/Desktop/workspace/jinfull/codex/clawdbot/skills'

async function main() {
  console.log(`Loading skills from: ${CLAWDBOT_SKILLS_DIR}\n`)

  const skills = await loadSkillsFromDir(CLAWDBOT_SKILLS_DIR)

  console.log(`Loaded ${skills.length} skills from clawdbot\n`)

  console.log('Skills:')
  for (const s of skills) {
    const desc = s.description.length > 70
      ? s.description.slice(0, 70) + '...'
      : s.description
    const tags = s.tags ? ` [${s.tags.join(', ')}]` : ''
    console.log(`  - ${s.name}: ${desc}${tags}`)
  }
}

main().catch(console.error)
