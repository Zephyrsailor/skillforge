import { describe, it, expect } from 'vitest'
import { SkillRegistry } from './registry.js'
import type { SkillDefinition } from './types.js'

function makeSkill(name: string, tags?: string[]): SkillDefinition {
  return {
    name,
    description: `Skill ${name}`,
    tags,
    async execute() {
      return { output: name, skillName: name, durationMs: 0 }
    },
  }
}

describe('SkillRegistry', () => {
  it('registers and retrieves a skill', () => {
    const reg = new SkillRegistry()
    const skill = makeSkill('test')
    reg.register(skill)
    expect(reg.get('test')).toBe(skill)
    expect(reg.size).toBe(1)
  })

  it('throws on duplicate registration', () => {
    const reg = new SkillRegistry()
    reg.register(makeSkill('dup'))
    expect(() => reg.register(makeSkill('dup'))).toThrow('already registered')
  })

  it('returns undefined for unknown skill', () => {
    const reg = new SkillRegistry()
    expect(reg.get('nope')).toBeUndefined()
  })

  it('lists all skills', () => {
    const reg = new SkillRegistry()
    reg.register(makeSkill('a'))
    reg.register(makeSkill('b'))
    expect(reg.list()).toHaveLength(2)
  })

  it('filters by tag', () => {
    const reg = new SkillRegistry()
    reg.register(makeSkill('a', ['dev']))
    reg.register(makeSkill('b', ['ops']))
    reg.register(makeSkill('c', ['dev', 'ops']))
    expect(reg.filterByTag('dev').map((s) => s.name)).toEqual(['a', 'c'])
    expect(reg.filterByTag('ops').map((s) => s.name)).toEqual(['b', 'c'])
  })

  it('removes a skill', () => {
    const reg = new SkillRegistry()
    reg.register(makeSkill('x'))
    expect(reg.remove('x')).toBe(true)
    expect(reg.get('x')).toBeUndefined()
    expect(reg.remove('x')).toBe(false)
  })
})
