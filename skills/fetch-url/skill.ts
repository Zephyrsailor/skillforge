/**
 * fetch-url skill: fetches content from a URL and returns a text summary.
 *
 * Extracts the URL from user input, fetches it, and returns the first
 * portion of the response body as plain text.
 */

import { defineSkill } from '../../src/index.js'

const URL_RE = /https?:\/\/[^\s]+/i

const MAX_BODY_LENGTH = 2000

export const fetchUrlSkill = defineSkill({
  name: 'fetch-url',
  description: 'Fetch content from a URL and return a text summary',
  tags: ['web', 'http', 'fetch'],
  keywords: ['fetch', 'url', 'http', 'get', 'download', 'webpage'],

  async execute(ctx) {
    const match = ctx.rawInput.match(URL_RE)
    if (!match) {
      return {
        output: 'No URL found in input. Please include a valid URL (e.g. https://example.com).',
        skillName: 'fetch-url',
        durationMs: 0,
      }
    }

    const url = match[0]

    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': 'SkillForge/0.1' },
        signal: AbortSignal.timeout(10_000),
      })

      if (!response.ok) {
        return {
          output: `HTTP ${response.status} ${response.statusText} for ${url}`,
          skillName: 'fetch-url',
          durationMs: 0,
        }
      }

      const contentType = response.headers.get('content-type') ?? ''
      if (!contentType.includes('text') && !contentType.includes('json')) {
        return {
          output: `Fetched ${url} — content-type: ${contentType} (binary content, not displayed)`,
          skillName: 'fetch-url',
          durationMs: 0,
        }
      }

      let body = await response.text()
      if (body.length > MAX_BODY_LENGTH) {
        body = body.slice(0, MAX_BODY_LENGTH) + '\n...(truncated)'
      }

      return {
        output: `Fetched ${url} (${response.status}):\n\n${body}`,
        skillName: 'fetch-url',
        durationMs: 0,
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return {
        output: `Failed to fetch ${url}: ${message}`,
        skillName: 'fetch-url',
        durationMs: 0,
      }
    }
  },
})
