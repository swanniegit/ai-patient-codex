# Repository Guidelines

## Project Structure & Module Organization
- Core TypeScript lives in `codex/`: `agents/` holds agent flows, `state/` the session machine, `schemas/` Zod models, and `scripts/` utility tasks.
- Security, persistence, and operational docs are in `codex/db/` and `codex/docs/`; review `security-plan.md` before changing auth or storage.
- Tests sit in `codex/tests/` (mirroring module names), static assets in `public/`, and compiled builds in `dist/`.

## Build, Test, and Development Commands
- `npm install` — install dependencies.
- `npm run build` — run `tsc` for type and schema validation.
- `npm run test` — execute the Vitest suite once; required before pushing.
- `npm run test:watch` — watch mode while iterating on flows.
- `npm run lint` — ESLint with TypeScript + unused-imports; resolve findings before committing.

## Coding Style & Naming Conventions
- Write modern TypeScript with ES modules, two-space indentation, and ≤100 character lines.
- Prefer named exports; suffix agent implementations with `Agent` and keep schemas singular PascalCase (e.g., `CaseRecord.ts`).
- Follow the repo ESLint/Prettier defaults; remove console logging and commented blocks prior to review.

## Testing Guidelines
- Place specs in `codex/tests/` using `{module}.test.ts`; reuse helpers from `testUtils.ts`.
- Cover orchestrator transitions, schema guards, Supabase adapters, and “no clinical advice” guardrails with explicit assertions.
- Add failing tests before implementing features; confirm `npm run test` (and any focused suites) passes locally.
- Highlight significant coverage gaps in PRs and propose follow-up tasks when risk remains.

## Commit & Pull Request Guidelines
- Keep commits focused; use imperative messages referencing the area (e.g., `Add PIN linker audit trail`).
- Link tickets or issues in commits/PRs when available; squash merges after approval.
- PRs must include a purpose summary, functional changes, test evidence, and security or compliance notes when applicable.
- Mark PRs ready once linting, tests, and documentation/schema updates are complete; notify downstreams if agent prompts or JSON schemas change.

## Security & Agent Guardrails
- Do not store PHI or clinical advice in logs or commits; redact identifiers per `codex/docs/security-plan.md`.
- Preserve provenance, consent, and clinician PIN linkage whenever editing agents or exporters.
- Validate Supabase RLS and encryption changes with updates to `codex/tests/supabaseRepository.test.ts`, and request a security review.
