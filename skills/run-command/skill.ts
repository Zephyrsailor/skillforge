/**
 * run-command skill: executes whitelisted shell commands and returns output.
 *
 * Safety: only commands in the ALLOWED_COMMANDS set can be executed.
 * All arguments are passed through; no shell expansion (uses execFile, not exec).
 */

import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { defineSkill } from '../../src/index.js'

const execFileAsync = promisify(execFile)

/** Commands considered safe for read-only system inspection. */
const ALLOWED_COMMANDS = new Set([
  'ls',
  'pwd',
  'whoami',
  'date',
  'uptime',
  'uname',
  'cat',
  'head',
  'tail',
  'wc',
  'echo',
  'which',
  'env',
  'df',
  'du',
  'ps',
  'git',
  'node',
  'bun',
  'pnpm',
  'npm',
])

const TIMEOUT_MS = 10_000

/**
 * Parse the command from user input.
 * Expects patterns like: "run ls -la" or "execute git status"
 */
function parseCommand(input: string): { bin: string; args: string[] } | null {
  // Strip leading "run"/"execute"/"exec"/"cmd" prefix if present
  const cleaned = input.replace(/^\s*(run|execute|exec|cmd)\s+/i, '').trim()
  if (!cleaned) return null

  const parts = cleaned.split(/\s+/)
  const bin = parts[0]
  const args = parts.slice(1)
  return { bin, args }
}

export const runCommandSkill = defineSkill({
  name: 'run-command',
  description: 'Execute a whitelisted shell command and return its output',
  tags: ['cli', 'shell', 'command'],
  keywords: ['run', 'execute', 'exec', 'command', 'shell', 'cmd'],

  async execute(ctx) {
    const parsed = parseCommand(ctx.rawInput)

    if (!parsed) {
      return {
        output: 'Could not parse a command from input. Try: "run ls -la"',
        skillName: 'run-command',
        durationMs: 0,
      }
    }

    const { bin, args } = parsed

    if (!ALLOWED_COMMANDS.has(bin)) {
      return {
        output: `Command "${bin}" is not in the allowed list.\nAllowed: ${[...ALLOWED_COMMANDS].join(', ')}`,
        skillName: 'run-command',
        durationMs: 0,
      }
    }

    try {
      const { stdout, stderr } = await execFileAsync(bin, args, {
        timeout: TIMEOUT_MS,
        maxBuffer: 1024 * 1024, // 1 MB
        env: process.env,
      })

      let output = ''
      if (stdout) output += stdout
      if (stderr) output += (output ? '\n' : '') + `[stderr] ${stderr}`
      if (!output) output = '(no output)'

      return {
        output: `$ ${bin} ${args.join(' ')}\n${output}`,
        skillName: 'run-command',
        durationMs: 0,
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return {
        output: `Command failed: ${bin} ${args.join(' ')}\n${message}`,
        skillName: 'run-command',
        durationMs: 0,
      }
    }
  },
})
