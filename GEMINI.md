# AI Assistant Instructions — Read This First

This project's complete guidelines — architecture, coding standards, i18n contract, security rules, and testing requirements — live in **[`AGENTS.md`](AGENTS.md)** at the repository root (written in Indonesian).

**Before making any change to this repository, read `AGENTS.md` in full.** Do not rely on file contents alone, and do not skip it because this file (`GEMINI.md`) exists — this file is only a pointer, not a substitute.

Recommended reading order for any AI assistant working in this repo:
1. [`AGENTS.md`](AGENTS.md) — base rules, architecture, coding standards
2. [`docs/ai_development_guide.md`](docs/ai_development_guide.md) — API map, implementation templates, Definition of Done checklist
3. [`docs/development_testing.md`](docs/development_testing.md) — testing standards, security, SonarQube
4. [`docs/index.md`](docs/index.md) — entry point to the rest of `docs/`

This file intentionally does not duplicate or paraphrase `AGENTS.md`. If anything here ever seems out of sync with it, `AGENTS.md` is always the authoritative source — update it (and its own cross-references) rather than this file.

---

## Forced context load (Gemini CLI `@import`)

The reading-order list above is a *recommendation* — nothing stops a model from skipping it. The two imports below are not optional reading: Gemini CLI loads their full contents into context automatically at the start of every session in this repo, whether or not you (the model reading this) would otherwise choose to open them. Treat everything that follows as if it were written directly in this file.

@./AGENTS.md

@./docs/dev_workflow_playbook.md

If the import above ever fails to render (e.g. you're seeing this file through a tool that doesn't support `@file` imports), open `AGENTS.md` and `docs/dev_workflow_playbook.md` yourself before touching any code — do not proceed on the strength of this pointer file alone.
