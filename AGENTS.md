# Repository Guidelines

## Project Structure & Module Organization
- Core TypeScript logic lives in `codex/`; `agents/` houses conversational flows, `state/` contains the session state machine, `schemas/` defines Zod models, and `scripts/` offers utility tasks.
- Operational records and security references sit under `codex/db/` and `codex/docs/`; review `codex/docs/security-plan.md` before changing storage or auth behavior.
- Tests mirror module names in `codex/tests/`, while static assets live in `public/` and compiled artifacts land in `dist/`.

## Build, Test, and Development Commands
- `npm install` — install or sync workspace dependencies.
- `npm run dev` — launch the local intake console with the orchestrator-backed API on port 3000.
- `npm run build` — type-check and validate schemas via `tsc`.
- `npm run test` — execute the Vitest suite once; required before pushing.
- `npm run test:watch` — run the same tests in watch mode during development.
- `npm run lint` — apply ESLint with TypeScript and unused-import rules; resolve all findings.

## Coding Style & Naming Conventions
- Author modern TypeScript with ES modules, two-space indentation, and lines ≤100 characters.
- Prefer named exports; suffix agent implementations with `Agent` and keep schemas in singular PascalCase (`CaseRecord.ts`).
- Remove console logging and commented-out blocks before review. The repo’s ESLint/Prettier defaults handle formatting.

## Testing Guidelines
- Write specs in `codex/tests/{module}.test.ts` using Vitest plus shared helpers from `testUtils.ts`.
- Cover orchestrator transitions, schema guards, Supabase adapters, and “no clinical advice” guardrails with explicit expectations.
- Add failing tests before implementing fixes; confirm `npm run test` (and any focused suites) passes locally.

## Commit & Pull Request Guidelines
- Keep commits focused with imperative summaries that reference the area (for example, `Add PIN linker audit trail`).
- PRs must include purpose, functional changes, test evidence, and security or compliance notes when relevant.
- Run linting, tests, and schema/doc updates before marking a PR ready; coordinate with downstream consumers when modifying agent prompts or JSON schemas.

## Security & Agent Guardrails
- Never store PHI or clinical advice in logs or commits; follow the redaction procedures in `codex/docs/security-plan.md`.
- Preserve provenance, consent, and clinician PIN linkage when editing agents or exporters.
- Validate Supabase RLS or encryption changes alongside updates to `codex/tests/supabaseRepository.test.ts`, and request a security review when in doubt.
