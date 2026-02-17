import { describe, it, expect } from 'vitest'
import { defineSkill, executeWithTiming } from './skill.js'

describe('defineSkill', () => {
  it('returns the skill definition', () => {
    const skill = defineSkill({
      name: 'test',
      description: 'a test skill',
      async execute() {
        return { output: 'ok', skillName: 'test', durationMs: 0 }
      },
    })
    expect(skill.name).toBe('test')
  })

  it('throws if name is missing', () => {
    expect(() =>
      defineSkill({
        name: '',
        description: 'x',
        async execute() {
          return { output: '', skillName: '', durationMs: 0 }
        },
      }),
    ).toThrow('name')
  })

  it('throws if description is missing', () => {
    expect(() =>
      defineSkill({
        name: 'x',
        description: '',
        async execute() {
          return { output: '', skillName: '', durationMs: 0 }
        },
      }),
    ).toThrow('description')
  })
})

describe('executeWithTiming', () => {
  it('measures duration and sets skillName', async () => {
    const skill = defineSkill({
      name: 'timed',
      description: 'a timed skill',
      async execute() {
        await new Promise((r) => setTimeout(r, 10))
        return { output: 'done', skillName: '', durationMs: 0 }
      },
    })
    const result = await executeWithTiming(skill, {
      input: 'test',
      rawInput: 'test',
    })
    expect(result.skillName).toBe('timed')
    expect(result.output).toBe('done')
    expect(result.durationMs).toBeGreaterThanOrEqual(5)
  })
})
