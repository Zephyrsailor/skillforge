/**
 * Core type definitions for SkillForge.
 *
 * A skill is the atomic unit of capability: it has a name, a description
 * (used for routing), and an execute function that turns input into output.
 */

// ---------------------------------------------------------------------------
// Skill Definition
// ---------------------------------------------------------------------------

export interface SkillDefinition<TInput = string, TOutput = string> {
  /** Unique identifier for this skill. */
  name: string

  /** Human-readable description; also used by the router to match user intent. */
  description: string

  /** Tags for category-based filtering and discovery. */
  tags?: string[]

  /** Optional JSON Schema describing structured input. */
  schema?: Record<string, unknown>

  /**
   * Keywords that help the router match user input to this skill.
   * Checked before falling back to description-based matching.
   */
  keywords?: string[]

  /** Execute the skill. */
  execute(ctx: SkillContext<TInput>): Promise<SkillResult<TOutput>>
}

// ---------------------------------------------------------------------------
// Execution Context
// ---------------------------------------------------------------------------

export interface SkillContext<T = string> {
  /** Parsed/typed input (same as rawInput for string skills). */
  input: T

  /** The user's original unmodified input string. */
  rawInput: string

  /** Arbitrary metadata passed through from the caller. */
  meta?: Record<string, unknown>
}

// ---------------------------------------------------------------------------
// Execution Result
// ---------------------------------------------------------------------------

export interface SkillResult<T = string> {
  /** The skill's output value. */
  output: T

  /** Which skill produced this result. */
  skillName: string

  /** Wall-clock execution time in milliseconds. */
  durationMs: number
}

// ---------------------------------------------------------------------------
// Router types
// ---------------------------------------------------------------------------

export interface RouteMatch {
  skill: SkillDefinition
  score: number
}
