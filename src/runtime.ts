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

    // When engine !== 'direct', delegate to agent-runner
    if (skill.engine && skill.engine !== 'direct') {
      return this.executeViaAgentRunner(skill, userInput)
    }

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

  /**
   * Execute a skill via agent-runner (Claude Code, Codex, etc.).
   * Dynamically imports agent-runner to avoid hard dependency.
   * Falls back to direct execute() if agent-runner is not available.
   */
  private async executeViaAgentRunner(
    skill: SkillDefinition,
    userInput: string,
  ): Promise<SkillResult> {
    const start = performance.now()

    try {
      // Try npm package first, fall back to local dev path
      let agentRunnerModule: { AgentRunner: new (config: { backend: string }) => { run(opts: { prompt: string; systemPrompt?: string; mode?: string }): Promise<{ text: string; durationMs: number }> } }
      try {
        agentRunnerModule = await import('@shurenwei/agent-runner')
      } catch {
        // Dev mode: resolve from sibling directory
        agentRunnerModule = await import('../../agent-runner/src/index.js')
      }

      const { AgentRunner } = agentRunnerModule
      const backend = skill.engine === 'codex' ? 'codex' : 'claude-code'
      const runner = new AgentRunner({ backend })

      // Use the skill's execute body as system prompt context if it returns instructions
      let systemPrompt: string | undefined
      try {
        const instructionResult = await skill.execute({
          input: userInput,
          rawInput: userInput,
        })
        if (instructionResult.output) {
          systemPrompt = instructionResult.output
        }
      } catch {
        // No instructions available, proceed without system prompt
      }

      const result = await runner.run({
        prompt: userInput,
        systemPrompt,
        mode: 'print',
      })

      const durationMs = Math.round(performance.now() - start)
      return {
        output: result.text,
        skillName: skill.name,
        durationMs,
      }
    } catch {
      // agent-runner not available; fall back to direct execute()
      const ctx = { input: userInput, rawInput: userInput }
      const result = await skill.execute(ctx)
      const durationMs = Math.round(performance.now() - start)
      return {
        ...result,
        skillName: skill.name,
        durationMs,
      }
    }
  }
}
