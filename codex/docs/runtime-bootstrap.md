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
- Other dependencies (Supabase clients, logging backends) can be added to `DependencyOptions` as the integration surface grows.

## Persistence Integration
- `SupabaseCaseRecordRepository` lives in `codex/app/storage/supabaseRepository.ts` and conforms to `CaseRecordRepository`.
- Use `createAutosave(repo)` (`codex/app/storage/autosave.ts`) to wire the repository into `AgentRunContext.autosave` when driving the orchestrator.
- Repository stores structured payloads and encrypted field metadata in the `case_records` table defined in the SQL migrations.
- `createSessionEnvironment(record, options)` (`codex/app/session.ts`) bundles orchestrator, dependencies, and autosave wiring for typical runtime usage.
