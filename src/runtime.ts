/**
 * SkillRuntime: the main entry point for the skill system.
 *
 * Accepts user input, routes to the best skill, executes it, returns the result.
 * Combines Registry + Router into a single convenient API.
 */

import { SkillRegistry } from './registry.js'
import { routeBest } from './router.js'
import { executeWithTiming } from './skill.js'
import type { SkillDefinition, SkillResult } from './types.js'

export class SkillRuntime {
  readonly registry: SkillRegistry

  constructor() {
    this.registry = new SkillRegistry()
  }

  /** Register a skill with the runtime. */
  register(skill: SkillDefinition): void {
    this.registry.register(skill)
  }

  /**
   * Handle user input: route to the best skill and execute it.
   * Returns null if no skill matches the input.
   */
  async handle(
    userInput: string,
    meta?: Record<string, unknown>,
  ): Promise<SkillResult | null> {
    const skills = this.registry.list()
    const skill = routeBest(skills, userInput)

    if (!skill) return null

    // TODO: When engine !== 'direct' (e.g. 'claude-code', 'codex'), delegate
    // execution to the corresponding agent-runner instead of calling execute()
    // directly. The agent-runner integration will:
    //   1. Spawn or connect to the target CLI agent
    //   2. Inject the skill's instructions as system prompt
    //   3. Pass userInput as the agent prompt
    //   4. Stream or collect the agent's output as SkillResult
    // For now, all skills run via direct execute() regardless of engine field.

    const ctx = {
      input: userInput,
      rawInput: userInput,
      meta,
    }

    return executeWithTiming(skill, ctx)
  }

  /**
   * Handle user input, throwing if no skill matches.
   */
  async handleOrThrow(
    userInput: string,
    meta?: Record<string, unknown>,
  ): Promise<SkillResult> {
    const result = await this.handle(userInput, meta)
    if (!result) {
      throw new Error(`No skill matched input: "${userInput}"`)
    }
    return result
  }

  /** List all registered skill names. */
  listSkills(): string[] {
    return this.registry.list().map((s) => s.name)
  }
}
