/**
 * Intent Router: matches user input to the best skill.
 *
 * MVP strategy: keyword matching + description word overlap scoring.
 * Designed to be replaced with semantic/vector routing later.
 */

import type { SkillDefinition, RouteMatch } from './types.js'

/** Escape special regex characters in a string. */
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Score how well a skill matches the given user input.
 * Returns 0 if no match, higher is better.
 */
export function scoreSkill(skill: SkillDefinition, input: string): number {
  const lower = input.toLowerCase()
  const words = lower.split(/\s+/)
  let score = 0

  // Phase 1: keyword match (highest signal)
  // Multi-word keywords use substring match; single-word keywords use word-boundary match
  // to avoid false positives like "hi" matching inside "something".
  if (skill.keywords) {
    for (const kw of skill.keywords) {
      const kwLower = kw.toLowerCase()
      if (kwLower.includes(' ')) {
        // Multi-word keyword: substring match is fine
        if (lower.includes(kwLower)) score += 10
      } else {
        // Single-word keyword: require word boundary
        const re = new RegExp(`\\b${escapeRegex(kwLower)}\\b`)
        if (re.test(lower)) score += 10
      }
    }
  }

  // Phase 2: tag match (word-boundary)
  if (skill.tags) {
    for (const tag of skill.tags) {
      const re = new RegExp(`\\b${escapeRegex(tag.toLowerCase())}\\b`)
      if (re.test(lower)) {
        score += 5
      }
    }
  }

  // Phase 3: description word overlap (lowest signal, broadest coverage)
  const descWords = skill.description.toLowerCase().split(/\s+/)
  for (const word of words) {
    if (word.length < 3) continue // skip tiny words
    if (descWords.includes(word)) {
      score += 1
    }
  }

  return score
}

/**
 * Route user input to the best matching skill from a list.
 * Returns all matches sorted by score (descending), or empty array if none match.
 */
export function route(skills: SkillDefinition[], input: string): RouteMatch[] {
  const matches: RouteMatch[] = []

  for (const skill of skills) {
    const score = scoreSkill(skill, input)
    if (score > 0) {
      matches.push({ skill, score })
    }
  }

  matches.sort((a, b) => b.score - a.score)
  return matches
}

/**
 * Route to a single best skill, or null if nothing matches.
 */
export function routeBest(
  skills: SkillDefinition[],
  input: string,
): SkillDefinition | null {
  const matches = route(skills, input)
  return matches.length > 0 ? matches[0].skill : null
}
