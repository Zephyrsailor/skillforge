/**
 * Basic SkillForge example: register 3 skills, demonstrate routing.
 *
 * Run: bun examples/basic.ts
 */

import { defineSkill, SkillRuntime } from '../src/index.js'

// ---------------------------------------------------------------------------
// Skill 1: Timestamp — returns current date/time
// ---------------------------------------------------------------------------
const timestampSkill = defineSkill({
  name: 'timestamp',
  description: 'Returns the current date and time',
  tags: ['utility', 'time'],
  keywords: ['time', 'date', 'now', 'timestamp', 'clock'],
  async execute() {
    const now = new Date()
    return {
      output: now.toISOString(),
      skillName: 'timestamp',
      durationMs: 0,
    }
  },
})

// ---------------------------------------------------------------------------
// Skill 2: Word Count — counts words in input
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// Skill 3: Greeting — responds to greetings
// ---------------------------------------------------------------------------
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
// Demo: create runtime, register skills, handle inputs
// ---------------------------------------------------------------------------
async function main() {
  const runtime = new SkillRuntime()

  runtime.register(timestampSkill)
  runtime.register(wordCountSkill)
  runtime.register(greetingSkill)

  console.log('Registered skills:', runtime.listSkills())
  console.log('---')

  const testInputs = [
    'What time is it now?',
    'Hello there!',
    'Count the words in this sentence please',
    'Hey good morning',
    'Something completely unrelated to any skill',
  ]

  for (const input of testInputs) {
    console.log(`Input:  "${input}"`)
    const result = await runtime.handle(input)
    if (result) {
      console.log(`Skill:  ${result.skillName}`)
      console.log(`Output: ${result.output}`)
      console.log(`Time:   ${result.durationMs}ms`)
    } else {
      console.log('Result: (no matching skill)')
    }
    console.log('---')
  }
}

main().catch(console.error)
