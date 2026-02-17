/**
 * HTTP API server for SkillForge.
 *
 * Endpoints:
 *   GET  /skills          List all loaded skills
 *   GET  /skills/:name    Get skill details
 *   POST /run             Route and execute a prompt
 *
 * Uses Node.js built-in http module (zero external dependencies).
 */

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import type { SkillRuntime } from './runtime.js'

export interface ServeOptions {
  port: number
  runtime: SkillRuntime
}

function json(res: ServerResponse, status: number, data: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(data))
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (c: Buffer) => chunks.push(c))
    req.on('end', () => resolve(Buffer.concat(chunks).toString()))
    req.on('error', reject)
  })
}

export function startServer(options: ServeOptions): void {
  const { port, runtime } = options

  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', `http://localhost:${port}`)
    const path = url.pathname
    const method = req.method ?? 'GET'

    // CORS headers for browser access
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

    if (method === 'OPTIONS') {
      res.writeHead(204)
      res.end()
      return
    }

    try {
      // GET /skills — list all skills
      if (method === 'GET' && path === '/skills') {
        const skills = runtime.registry.list().map((s) => ({
          name: s.name,
          description: s.description,
          tags: s.tags ?? [],
          engine: s.engine ?? 'direct',
        }))
        json(res, 200, { skills, total: skills.length })
        return
      }

      // GET /skills/:name — get skill details
      if (method === 'GET' && path.startsWith('/skills/')) {
        const name = path.slice('/skills/'.length)
        const skill = runtime.registry.get(name)
        if (!skill) {
          json(res, 404, { error: `Skill "${name}" not found` })
          return
        }
        json(res, 200, {
          name: skill.name,
          description: skill.description,
          tags: skill.tags ?? [],
          keywords: skill.keywords ?? [],
          engine: skill.engine ?? 'direct',
        })
        return
      }

      // POST /run — route and execute
      if (method === 'POST' && path === '/run') {
        const body = await readBody(req)
        let payload: { prompt?: string }
        try {
          payload = JSON.parse(body)
        } catch {
          json(res, 400, { error: 'Invalid JSON body' })
          return
        }

        if (!payload.prompt) {
          json(res, 400, { error: 'Missing "prompt" field' })
          return
        }

        const result = await runtime.handle(payload.prompt)
        if (!result) {
          json(res, 404, {
            error: 'No matching skill found',
            prompt: payload.prompt,
          })
          return
        }

        json(res, 200, {
          skillName: result.skillName,
          output: result.output,
          durationMs: result.durationMs,
        })
        return
      }

      // 404 for everything else
      json(res, 404, {
        error: 'Not found',
        endpoints: [
          'GET /skills',
          'GET /skills/:name',
          'POST /run { "prompt": "..." }',
        ],
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      json(res, 500, { error: message })
    }
  })

  server.listen(port, () => {
    console.log(`SkillForge API server running on http://localhost:${port}`)
    console.log(`${runtime.listSkills().length} skills loaded`)
    console.log()
    console.log('Endpoints:')
    console.log(`  GET  http://localhost:${port}/skills`)
    console.log(`  GET  http://localhost:${port}/skills/:name`)
    console.log(`  POST http://localhost:${port}/run`)
  })
}
