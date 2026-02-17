/**
 * Intent Router: matches user input to the best skill.
 *
 * Scoring strategy (in priority order):
 *   1. Skill name exact match (highest)
 *   2. Keyword match (word-boundary for single words, substring for phrases)
 *   3. Tag match (word-boundary)
 *   4. Description relevance (TF-IDF-like: penalizes common words across skills)
 *
 * Designed to be replaced with semantic/vector routing later.
 */

import type { SkillDefinition, RouteMatch } from './types.js'

/** Escape special regex characters in a string. */
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Common stop words to skip in description matching. */
const STOP_WORDS = new Set([
  'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had',
  'her', 'was', 'one', 'our', 'out', 'has', 'have', 'from', 'they', 'been',
  'said', 'each', 'she', 'which', 'their', 'will', 'way', 'about', 'use',
  'when', 'what', 'your', 'how', 'this', 'that', 'with', 'via', 'using',
  'into', 'also', 'than', 'them', 'then', 'its', 'over', 'such', 'more',
])

/**
 * Tokenize a string into lowercase words, filtering out stop words and
 * words shorter than 3 characters.
 */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 3 && !STOP_WORDS.has(w))
}

/**
 * Build an inverse document frequency map from a collection of skills.
 * Words that appear in many skill descriptions get lower weight.
 */
export function buildIdf(skills: SkillDefinition[]): Map<string, number> {
  const docCount = skills.length
  const wordDocFreq = new Map<string, number>()

  for (const skill of skills) {
    const unique = new Set(tokenize(skill.description))
    for (const word of unique) {
      wordDocFreq.set(word, (wordDocFreq.get(word) ?? 0) + 1)
    }
  }

  const idf = new Map<string, number>()
  for (const [word, freq] of wordDocFreq) {
    // Standard IDF: log(N / df). Higher = more unique to fewer skills.
    idf.set(word, Math.log(docCount / freq))
  }
  return idf
}

/**
 * Score how well a skill matches the given user input.
 * Returns 0 if no match, higher is better.
 *
 * @param idf Optional IDF map for description weighting. If not provided,
 *   description words are weighted equally (weight=1).
 */
export function scoreSkill(
  skill: SkillDefinition,
  input: string,
  idf?: Map<string, number>,
): number {
  const lower = input.toLowerCase()
  const inputTokens = tokenize(input)
  let score = 0

  // Phase 0: skill name match (strongest signal)
  // If user input contains the exact skill name, it's very likely the target.
  const nameRe = new RegExp(`\\b${escapeRegex(skill.name.toLowerCase())}\\b`)
  if (nameRe.test(lower)) {
    score += 20
  }

  // Phase 1: keyword match
  if (skill.keywords) {
    for (const kw of skill.keywords) {
      const kwLower = kw.toLowerCase()
      if (kwLower.includes(' ')) {
        if (lower.includes(kwLower)) score += 10
      } else {
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

  // Phase 3: description relevance (IDF-weighted word overlap)
  // Uses fuzzy prefix matching to handle plurals/suffixes (email vs emails)
  const descTokens = tokenize(skill.description)
  const descSet = new Set(descTokens)
  for (const word of inputTokens) {
    let matched = false

    // Exact match
    if (descSet.has(word)) {
      matched = true
    } else {
      // Fuzzy: check if input word is a prefix of a desc word or vice versa
      // (handles email/emails, rebase/rebasing, etc.)
      for (const dw of descTokens) {
        if (
          (word.length >= 4 && dw.startsWith(word)) ||
          (dw.length >= 4 && word.startsWith(dw))
        ) {
          matched = true
          break
        }
      }
    }

    if (matched) {
      const weight = idf ? (idf.get(word) ?? 1) : 1
      score += weight
    }
  }

  return score
}

/**
 * Route user input to the best matching skill from a list.
 * Returns all matches sorted by score (descending), or empty array if none match.
 *
 * Pre-computes IDF weights when there are many skills to improve relevance.
 */
export function route(skills: SkillDefinition[], input: string): RouteMatch[] {
  // Build IDF for description-based scoring when there are enough skills
  const idf = skills.length >= 5 ? buildIdf(skills) : undefined

  const matches: RouteMatch[] = []

  for (const skill of skills) {
    const score = scoreSkill(skill, input, idf)
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
  return matches.length > 0 ? matches[0]!.skill : null
}
