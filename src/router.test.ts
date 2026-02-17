import { describe, it, expect } from 'vitest'
import { scoreSkill, route, routeBest } from './router.js'
import type { SkillDefinition } from './types.js'

function makeSkill(
  overrides: Partial<SkillDefinition> & { name: string },
): SkillDefinition {
  return {
    description: `Skill ${overrides.name}`,
    async execute() {
      return { output: '', skillName: overrides.name, durationMs: 0 }
    },
    ...overrides,
  }
}

describe('scoreSkill', () => {
  it('scores keyword match', () => {
    const skill = makeSkill({
      name: 'time',
      keywords: ['time', 'clock'],
      description: 'tells the time',
    })
    expect(scoreSkill(skill, 'what time is it')).toBeGreaterThan(0)
  })

  it('does not match keywords as substrings', () => {
    const skill = makeSkill({
      name: 'greet',
      keywords: ['hi'],
      description: 'greets you',
    })
    // "hi" should NOT match inside "something"
    expect(scoreSkill(skill, 'something')).toBe(0)
    // "hi" should match as standalone word
    expect(scoreSkill(skill, 'hi there')).toBeGreaterThan(0)
  })

  it('matches multi-word keywords as substrings', () => {
    const skill = makeSkill({
      name: 'greet',
      keywords: ['good morning'],
      description: 'greets you',
    })
    expect(scoreSkill(skill, 'hey good morning')).toBeGreaterThan(0)
  })

  it('scores tag match', () => {
    const skill = makeSkill({
      name: 'git',
      tags: ['git'],
      description: 'git operations',
    })
    expect(scoreSkill(skill, 'help with git')).toBeGreaterThan(0)
  })

  it('scores description word overlap', () => {
    const skill = makeSkill({
      name: 'weather',
      description: 'returns current weather forecast for a location',
    })
    expect(scoreSkill(skill, 'weather forecast')).toBeGreaterThan(0)
  })

  it('returns 0 for no match', () => {
    const skill = makeSkill({
      name: 'time',
      keywords: ['time'],
      description: 'tells the time',
    })
    expect(scoreSkill(skill, 'random unrelated input')).toBe(0)
  })
})

describe('route', () => {
  it('returns matches sorted by score', () => {
    const skills = [
      makeSkill({
        name: 'a',
        keywords: ['hello'],
        description: 'says hello',
      }),
      makeSkill({
        name: 'b',
        keywords: ['hello', 'hi', 'greet'],
        tags: ['greeting'],
        description: 'greeting that says hello and hi',
      }),
    ]
    // "hi there hello" matches both; b gets extra keyword hits for "hi"
    const matches = route(skills, 'hi there hello')
    expect(matches.length).toBe(2)
    expect(matches[0].skill.name).toBe('b')
    expect(matches[0].score).toBeGreaterThan(matches[1].score)
  })

  it('returns empty for no matches', () => {
    const skills = [makeSkill({ name: 'a', keywords: ['xyz'] })]
    expect(route(skills, 'nothing related')).toEqual([])
  })
})

describe('routeBest', () => {
  it('returns best match', () => {
    const skills = [
      makeSkill({ name: 'time', keywords: ['time'], description: 'time' }),
      makeSkill({
        name: 'weather',
        keywords: ['weather'],
        description: 'weather',
      }),
    ]
    expect(routeBest(skills, 'what time')?.name).toBe('time')
    expect(routeBest(skills, 'weather today')?.name).toBe('weather')
  })

  it('returns null when nothing matches', () => {
    expect(routeBest([], 'anything')).toBeNull()
  })
})
