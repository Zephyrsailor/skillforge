/**
 * Helper for defining skills with type inference.
 */

import type { SkillContext, SkillDefinition, SkillResult } from './types.js'

/**
 * Define a skill. This is a convenience wrapper that provides type inference
 * and validates the required fields at definition time.
 *
 * @example
 * ```ts
 * const mySkill = defineSkill({
 *   name: 'hello',
 *   description: 'Says hello',
 *   keywords: ['hello', 'hi', 'greet'],
 *   async execute(ctx) {
 *     return { output: `Hello! You said: ${ctx.rawInput}`, skillName: 'hello', durationMs: 0 }
 *   }
 * })
 * ```
 */
export function defineSkill<TInput = string, TOutput = string>(
  def: SkillDefinition<TInput, TOutput>,
): SkillDefinition<TInput, TOutput> {
  if (!def.name) throw new Error('Skill must have a name')
  if (!def.description) throw new Error('Skill must have a description')
  if (!def.execute) throw new Error('Skill must have an execute function')
  return def
}

/**
 * Helper to build a SkillResult with automatic duration tracking.
 * Wraps the execute function so the caller doesn't have to measure time.
 */
export async function executeWithTiming<TInput, TOutput>(
  skill: SkillDefinition<TInput, TOutput>,
  ctx: SkillContext<TInput>,
): Promise<SkillResult<TOutput>> {
  const start = performance.now()
  const result = await skill.execute(ctx)
  const durationMs = Math.round(performance.now() - start)
  return {
    ...result,
    skillName: skill.name,
    durationMs,
  }
}
