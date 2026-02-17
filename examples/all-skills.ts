/**
 * SkillForge example: all built-in skills registered and routed.
 *
 * Run: bun examples/all-skills.ts
 */

import { SkillRuntime } from '../src/index.js'
import { fetchUrlSkill } from '../skills/fetch-url/skill.js'
import { runCommandSkill } from '../skills/run-command/skill.js'

// Import the basic skills from the basic example inline
import { defineSkill } from '../src/index.js'

const timestampSkill = defineSkill({
  name: 'timestamp',
  description: 'Returns the current date and time',
  tags: ['utility', 'time'],
  keywords: ['time', 'date', 'now', 'timestamp', 'clock'],
  async execute() {
    return {
      output: new Date().toISOString(),
      skillName: 'timestamp',
      durationMs: 0,
    }
  },
})

const wordCountSkill = defineSkill({
  name: 'word-count',
  description: 'Counts the number of words in the given text',
  tags: ['utility', 'text'],
  keywords: ['count', 'words', 'word count', 'how many words'],
  async execute(ctx) {
    const words = ctx.rawInput.trim().split(/\s+/).length
    return {
      output: `${words} words`,
      skillName: 'word-count',
      durationMs: 0,
    }
  },
})

const greetingSkill = defineSkill({
  name: 'greeting',
  description: 'Responds to greetings and hellos from the user',
  tags: ['social'],
  keywords: ['hello', 'hi', 'hey', 'greet', 'good morning', 'good evening'],
  async execute(ctx) {
    const hour = new Date().getHours()
    let timeGreeting = 'Hello'
    if (hour < 12) timeGreeting = 'Good morning'
    else if (hour < 18) timeGreeting = 'Good afternoon'
    else timeGreeting = 'Good evening'
    return {
      output: `${timeGreeting}! You said: "${ctx.rawInput}"`,
      skillName: 'greeting',
      durationMs: 0,
    }
  },
})

// ---------------------------------------------------------------------------

async function main() {
  const runtime = new SkillRuntime()

  runtime.register(timestampSkill)
  runtime.register(wordCountSkill)
  runtime.register(greetingSkill)
  runtime.register(fetchUrlSkill)
  runtime.register(runCommandSkill)

  console.log('Registered skills:', runtime.listSkills())
  console.log('---')

  const testInputs = [
    'What time is it?',
    'Hello!',
    'Count the words in this sentence',
    'fetch https://httpbin.org/get',
    'run uname -a',
    'run rm -rf /',  // should be blocked by whitelist
    'Something random with no skill match',
  ]

  for (const input of testInputs) {
    console.log(`\nInput: "${input}"`)
    const result = await runtime.handle(input)
    if (result) {
      console.log(`Skill: ${result.skillName} (${result.durationMs}ms)`)
      console.log(`Output:\n${result.output}`)
    } else {
      console.log('(no matching skill)')
    }
    console.log('---')
  }
}

main().catch(console.error)
