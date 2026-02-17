import { describe, it, expect } from 'vitest'
import { SkillRuntime } from './runtime.js'
import { defineSkill } from './skill.js'

const timeSkill = defineSkill({
  name: 'time',
  description: 'tells the current time',
  keywords: ['time', 'clock'],
  async execute() {
    return { output: '12:00', skillName: 'time', durationMs: 0 }
  },
})

const echoSkill = defineSkill({
  name: 'echo',
  description: 'echoes back the input',
  keywords: ['echo', 'repeat'],
  async execute(ctx) {
    return { output: ctx.rawInput, skillName: 'echo', durationMs: 0 }
  },
})

describe('SkillRuntime', () => {
  it('registers and lists skills', () => {
    const rt = new SkillRuntime()
    rt.register(timeSkill)
    rt.register(echoSkill)
    expect(rt.listSkills()).toEqual(['time', 'echo'])
  })

  it('handles input by routing to best skill', async () => {
    const rt = new SkillRuntime()
    rt.register(timeSkill)
    rt.register(echoSkill)

    const result = await rt.handle('what time is it')
    expect(result).not.toBeNull()
    expect(result!.skillName).toBe('time')
    expect(result!.output).toBe('12:00')
  })

  it('returns null for unmatched input', async () => {
    const rt = new SkillRuntime()
    rt.register(timeSkill)
    const result = await rt.handle('completely unrelated query')
    expect(result).toBeNull()
  })

  it('handleOrThrow throws for unmatched input', async () => {
    const rt = new SkillRuntime()
    await expect(rt.handleOrThrow('nope')).rejects.toThrow('No skill matched')
  })

  it('passes meta through to skill context', async () => {
    const rt = new SkillRuntime()
    let receivedMeta: Record<string, unknown> | undefined
    rt.register(
      defineSkill({
        name: 'meta-test',
        description: 'test meta passing',
        keywords: ['meta'],
        async execute(ctx) {
          receivedMeta = ctx.meta
          return { output: 'ok', skillName: 'meta-test', durationMs: 0 }
        },
      }),
    )
    await rt.handle('meta', { userId: '123' })
    expect(receivedMeta).toEqual({ userId: '123' })
  })
})
