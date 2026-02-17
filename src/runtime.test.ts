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

  it('routes to correct skill among many', async () => {
    const rt = new SkillRuntime()
    rt.register(timeSkill)
    rt.register(echoSkill)
    rt.register(
      defineSkill({
        name: 'weather',
        description: 'returns the weather forecast',
        keywords: ['weather', 'forecast', 'temperature'],
        tags: ['weather'],
        async execute() {
          return { output: 'sunny 25C', skillName: 'weather', durationMs: 0 }
        },
      }),
    )
    const result = await rt.handle('what is the weather forecast today')
    expect(result).not.toBeNull()
    expect(result!.skillName).toBe('weather')
    expect(result!.output).toBe('sunny 25C')
  })

  it('result includes durationMs from executeWithTiming', async () => {
    const rt = new SkillRuntime()
    rt.register(
      defineSkill({
        name: 'slow',
        description: 'a slow skill',
        keywords: ['slow'],
        async execute() {
          await new Promise((r) => setTimeout(r, 15))
          return { output: 'done', skillName: 'slow', durationMs: 0 }
        },
      }),
    )
    const result = await rt.handle('slow')
    expect(result).not.toBeNull()
    expect(result!.durationMs).toBeGreaterThanOrEqual(10)
  })

  it('registry is accessible for tag filtering', () => {
    const rt = new SkillRuntime()
    rt.register(
      defineSkill({
        name: 'a',
        description: 'skill a',
        tags: ['dev'],
        keywords: ['aaa'],
        async execute() {
          return { output: '', skillName: 'a', durationMs: 0 }
        },
      }),
    )
    rt.register(
      defineSkill({
        name: 'b',
        description: 'skill b',
        tags: ['ops'],
        keywords: ['bbb'],
        async execute() {
          return { output: '', skillName: 'b', durationMs: 0 }
        },
      }),
    )
    rt.register(
      defineSkill({
        name: 'c',
        description: 'skill c',
        tags: ['dev', 'ops'],
        keywords: ['ccc'],
        async execute() {
          return { output: '', skillName: 'c', durationMs: 0 }
        },
      }),
    )
    expect(rt.registry.filterByTag('dev').map((s) => s.name)).toEqual(['a', 'c'])
    expect(rt.registry.filterByTag('ops').map((s) => s.name)).toEqual(['b', 'c'])
    expect(rt.registry.filterByTag('none')).toEqual([])
  })

  it('handles empty registry gracefully', async () => {
    const rt = new SkillRuntime()
    expect(rt.listSkills()).toEqual([])
    const result = await rt.handle('anything')
    expect(result).toBeNull()
  })

  it('skill execute receives rawInput unchanged', async () => {
    const rt = new SkillRuntime()
    let captured = ''
    rt.register(
      defineSkill({
        name: 'capture',
        description: 'captures input',
        keywords: ['capture'],
        async execute(ctx) {
          captured = ctx.rawInput
          return { output: 'ok', skillName: 'capture', durationMs: 0 }
        },
      }),
    )
    await rt.handle('  capture  THIS  Input  ')
    expect(captured).toBe('  capture  THIS  Input  ')
  })
})
