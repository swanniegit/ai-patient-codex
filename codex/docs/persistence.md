# Persistence Layer Overview

## Case Record Repository
- Located at `codex/app/storage/supabaseRepository.ts`.
- Implements `CaseRecordRepository` interface (`codex/app/storage/types.ts`).
- Responsibilities:
  - `save(record)` → maps `CaseRecord` into table columns (`case_records`) using `payload` JSON + `encrypted_fields` snapshot.
  - `fetchById(caseId)` → retrieves row, merges stored payload with metadata, validates via Zod schema.
- Uses a thin `SupabaseClientLike` abstraction to avoid hard dependency on `@supabase/supabase-js` during scaffolding.

## Autosave Hook
- `createAutosave(repo)` (`codex/app/storage/autosave.ts`) produces a function suitable for the `AgentRunContext.autosave` slot.
- Pass this into orchestrator steps so every agent persists snapshots automatically.

## Table Mapping
| Column              | Source                                 |
|---------------------|-----------------------------------------|
| `case_id`           | `CaseRecord.caseId`                      |
| `clinician_id`      | `CaseRecord.clinicianId`                 |
| `clinician_pin_hash`| `CaseRecord.clinicianPinHash`            |
| `storage_meta`      | `CaseRecord.storageMeta`                 |
| `payload`           | Structured subset (patient, wounds, etc.)|
| `encrypted_fields`  | `CaseRecord.encryptedFields`             |
| `consent_granted`   | `CaseRecord.consentGranted`              |
| `status`            | `CaseRecord.status`                      |
| `created_at`        | `CaseRecord.createdAt`                   |
| `updated_at`        | `CaseRecord.updatedAt`                   |

## Next Steps
1. Replace `SupabaseClientLike` with the actual client once dependencies are installed.
2. Add retry/backoff logic and granular error handling.
3. Expand repository suite to handle artifact CRUD and provenance logging.
