# Changelog

## v0.1.0 (2026-02-18)

### Added
- Core: SkillRuntime, SkillRegistry, Router (TF-IDF + name/tag/description scoring)
- SKILL.md loader: compatible with OpenClaw/clawdbot format (51/52 skills)
- CLI: `run`, `list`, `info`, `serve` commands with `--dir`, `--engine`, `--port`
- HTTP API server (zero dependencies): GET /skills, GET /skills/:name, POST /run
- agent-runner integration: SKILL.md body as system prompt for Claude Code / Codex
- 41 unit tests
