# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

- `npm run dev` - Launch the local intake console with orchestrator-backed API on port 3000
- `npm run build` - Type-check and validate schemas via TypeScript compiler
- `npm run test` - Execute the Vitest suite once (required before pushing)
- `npm run test:watch` - Run tests in watch mode during development
- `npm run lint` - Apply ESLint with TypeScript and unused-import rules (resolve all findings)
- `npm install` - Install or sync workspace dependencies

## Architecture Overview

This is an AI-powered patient data collection system built around a **finite state machine orchestrator** that manages conversational flows through specialized agents. The system is designed for healthcare data intake with strict security, compliance, and provenance tracking.

### Core Architecture Components

**Agent-Based System**: Each step in the data collection workflow is handled by a specialized agent (BioAgent, WoundImagingAgent, VitalsAgent, etc.) that implements the `Agent<TInput, TOutput>` interface. Agents receive input, update the case record, and return results with provenance tracking.

**State Machine Orchestration**: The `Orchestrator` class manages transitions between session states (`START` → `BIO_INTAKE` → `WOUND_IMAGING` → `VITALS` → `TIME` → `FOLLOW_UP` → `REVIEW` → etc.) using a StateMachine that ensures valid workflow progression.

**Schema-First Design**: All data structures use Zod schemas for validation, including the central `CaseRecord` schema that encompasses patient bio, wound photos, vitals, time assessments, and metadata with encryption support.

**Security & Compliance**: Built-in PHI protection with encryption fields, provenance logging, clinician PIN authentication, and consent tracking. Never store clinical advice or sensitive data in logs.

### Directory Structure

- **`codex/agents/`** - Conversational flow agents implementing the Agent interface
- **`codex/schemas/`** - Zod validation schemas (CaseRecord, PatientBio, Vitals, etc.)
- **`codex/state/`** - Finite state machine orchestration (StateMachine.ts, transitions.ts)
- **`codex/prompts/`** - System prompts as .md files for agent behavior
- **`codex/tests/`** - Vitest test suite mirroring module structure
- **`codex/docs/`** - Security plans, compliance, and operational documentation
- **`api/`** - API endpoints for session management
- **`public/`** - Static assets

### Key Implementation Patterns

**Agent Interface**: All agents must implement `run(input, context)` returning `AgentResult<TOutput>` with optional record updates and provenance entries.

**Record Updates**: Agents update the case record immutably and include provenance entries for auditability. The orchestrator manages record state transitions.

**Session Flow**: The system progresses through defined states with specific transition events. Each state may have an associated agent that processes input and advances the workflow.

**Schema Validation**: Use Zod schemas consistently for all data validation. The CaseRecord schema includes encryption fields, provenance tracking, and consent management.

## Testing Guidelines

- Write specs in `codex/tests/{module}.test.ts` using Vitest with shared helpers from `testUtils.ts`
- Cover orchestrator transitions, schema guards, Supabase adapters, and "no clinical advice" guardrails
- Add failing tests before implementing fixes
- Ensure `npm run test` passes locally before commits

## Security Requirements

- Never store PHI or clinical advice in logs or commits
- Follow redaction procedures in `codex/docs/security-plan.md`
- Preserve provenance, consent, and clinician PIN linkage when editing agents
- Validate Supabase RLS or encryption changes alongside `codex/tests/supabaseRepository.test.ts`
- Request security review when modifying authentication or data storage

## Code Style

- Modern TypeScript with ES modules, two-space indentation, lines ≤100 characters
- Prefer named exports over default exports
- Suffix agent implementations with `Agent`, keep schemas in singular PascalCase
- Remove console logging and commented-out blocks before review
- Import ordering: external libraries first, then internal modules (alphabetically)
- Use Zod for all data validation and type inference

## Commit Guidelines

- Use imperative summaries referencing the area (e.g., "Add PIN linker audit trail")
- Include purpose, functional changes, test evidence, and security/compliance notes in PRs
- Run linting, tests, and schema updates before marking PR ready
- Coordinate with downstream consumers when modifying agent prompts or schemas