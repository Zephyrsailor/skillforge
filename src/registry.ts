/**
 * SkillRegistry: in-memory store for registered skills.
 * Supports register, get, list, and tag-based filtering.
 */

import type { SkillDefinition } from './types.js'

export class SkillRegistry {
  private skills = new Map<string, SkillDefinition>()

  /** Register a skill. Throws if a skill with the same name already exists. */
  register(skill: SkillDefinition): void {
    if (this.skills.has(skill.name)) {
      throw new Error(`Skill "${skill.name}" is already registered`)
    }
    this.skills.set(skill.name, skill)
  }

  /** Get a skill by name, or undefined if not found. */
  get(name: string): SkillDefinition | undefined {
    return this.skills.get(name)
  }

  /** List all registered skills. */
  list(): SkillDefinition[] {
    return [...this.skills.values()]
  }

  /** Filter skills by tag. Returns skills that have at least one matching tag. */
  filterByTag(tag: string): SkillDefinition[] {
    return this.list().filter((s) => s.tags?.includes(tag))
  }

  /** Remove a skill by name. Returns true if it existed. */
  remove(name: string): boolean {
    return this.skills.delete(name)
  }

  /** Number of registered skills. */
  get size(): number {
    return this.skills.size
  }
}
