# Runtime Bootstrap Guide

The wound-care orchestrator now uses a centralized dependency factory so runtime wiring stays modular and testable.

## Agent Dependencies
- `createAgentDependencies(options)` lives in `codex/app/dependencies.ts`.
- Defaults:
  - Loads prompts from `codex/prompts` using a file-backed loader.
  - Instantiates `EnvKeyCryptoProvider`, reading `FIELD_ENCRYPTION_KEY` (+ optional `_VERSION`).
  - Accepts optional custom logger, prompt directory, or injected crypto provider for tests.
- If the encryption env vars are missing, the factory logs a warning (when logger provided) and continues without a crypto provider so non-sensitive flows can proceed in local dev.

## Orchestrator Assembly
- `buildOrchestrator(record, options)` (`codex/app/orchestrator.ts`) bootstraps a `StateMachine` and registers agents per workflow state.
- Pass `initialState` to resume partial sessions; dependency options forward to `createAgentDependencies`.
- Example usage:

```ts
import { buildOrchestrator } from "./codex/app/orchestrator";
import { createStubCaseRecord } from "./codex/tests/testUtils";

const orchestrator = buildOrchestrator(createStubCaseRecord());
```

## Environment Expectations
- Set `FIELD_ENCRYPTION_KEY` (base64 32-byte key) before bootstrapping in production; optionally define `FIELD_ENCRYPTION_KEY_VERSION` and legacy key map for rotations.
- Provide `GEMINI_API_KEY` (and optional `GEMINI_MODEL`) so the dependency factory can wire a Gemini-backed LLM client for prompt flows.
- Define `SUPABASE_URL` plus either `SUPABASE_SERVICE_ROLE` or `SUPABASE_ANON_KEY` to auto-create the live case-record repository when building session environments.
- Other dependencies (Supabase clients, logging backends) can be added to `DependencyOptions` as the integration surface grows.

## Repository Wiring
- `createSessionController({ caseId, clinicianId })` (`codex/server/sessionRuntime/index.js`) resolves the backing repository per request.
- When Supabase env vars are present, it instantiates `SupabaseCaseRecordRepository`; otherwise an in-memory repository is reused per case ID within the runtime.
- Existing records hydrate via `repository.fetchById(caseId)`; blank sessions fall back to `createBlankCaseRecord({ caseId })`.
- Session workflow state persists in `CaseRecord.storageMeta.state` (default `BIO_INTAKE`), ensuring API snapshots and orchestrator boots resume the correct stage after autosave.
- Autosave hooks persist updates on each agent run, ensuring `/api/session/*` routes serve the latest case snapshot.

## Session Identity Contract
- API routes require both `X-Session-Id` and `X-Clinician-Id` headers. Missing values return `400`.
- The `codex_session=<session-id>` cookie mirrors the session header so edge middleware or downstream services can reuse it.
- Repository hydration rejects mismatched clinician IDs with `403` to prevent cross-tenant access.
- Frontend bootstrap (`public/scripts/main.js`) generates stable demo identifiers via `localStorage` in local dev; production clients must supply authenticated values.
- `/api/session/events/:event` accepts supported `SessionEvent` transitions (for example, `BIO_CONFIRMED`) and persists the resulting `storageMeta.state` before returning the updated snapshot.

## Persistence Integration
- `SupabaseCaseRecordRepository` lives in `codex/app/storage/supabaseRepository.ts` and conforms to `CaseRecordRepository`.
- Use `createAutosave(repo)` (`codex/app/storage/autosave.ts`) to wire the repository into `AgentRunContext.autosave` when driving the orchestrator.
- Repository stores structured payloads and encrypted field metadata in the `case_records` table defined in the SQL migrations.
- `createSessionEnvironment(record, options)` (`codex/app/session.ts`) bundles orchestrator, dependencies, and autosave wiring for typical runtime usage.
