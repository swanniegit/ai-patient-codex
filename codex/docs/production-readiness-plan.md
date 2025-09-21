# Production Readiness Plan

This roadmap turns the wound-care orchestrator from prototype to production-ready system. Each phase lists required outcomes, owners, and artifacts to help future sessions pick up work quickly.

## Phase 0 – Foundations

- **Security baseline:** Compare current repo against `codex/docs/security-plan.md`; log discrepancies (RLS, key rotation, audit logging, consent workflows).
- **Supabase environments:** Provision `supabase-dev`, `supabase-stage`, `supabase-prod`; apply migrations from version control and note connection strings in secret store.
- **Secrets hygiene:** Publish `.env.example` with placeholder keys, enable gitleaks/secretlint in CI, and document secret rotation cadence.
- **Contract documentation:** Capture `SessionSnapshot` shapes, agent inputs/outputs, and autosave expectations in `codex/docs/runtime-bootstrap.md`.

## Phase 1 – Backend Runtime

- **Repository abstraction:** Refactor `SessionController` to accept a storage adapter; implement Supabase-backed repository with encryption awareness.
- **API surface:** Expand Vercel routes (`/api/session/:id`, `/api/session/events/:event`) to manage orchestrator lifecycle, including case selection and resumable sessions.
- **Session identity:** Issue UUID session tokens via secure cookies/headers, scoped per clinician; enforce multi-tenant separation and persist encrypted payloads.
- **Autosave + provenance:** Queue autosave writes and append provenance entries per agent update to satisfy audit requirements.

## Phase 2 – Frontend Orchestrator Console

- **State management:** Replace ad-hoc DOM updates with componentized state (e.g., Preact signals/Zustand) to support multiple panels and optimistic updates.
- **Workflow panels:** Implement dedicated UI for imaging uploads, vitals capture, follow-up tracking, and export reviews; surface validation errors inline.
- **Timeline visibility:** Drive timeline and status badges from orchestrator state plus provenance log, with actionable blockers.
- **Auth guard:** Integrate clinician login (Supabase Auth or Vercel middleware) and persist session ID securely client-side.

## Phase 3 – Security & Compliance

- **Supabase RLS:** Enforce row-level policies tied to clinician org + case ID; test via `codex/tests/supabaseRepository.test.ts`.
- **Key management:** Support `FIELD_ENCRYPTION_KEY_VERSION` with legacy map, document rotation playbook, and schedule 90-day rotations.
- **Audit logging:** Emit structured logs (no PHI) to monitoring sink; include case ID, agent, state, consent flag.
- **Consent & PIN guardrails:** Link SecurityAgent outputs to API responses, blocking workflow progress without verified consent and PIN linkage.

## Phase 4 – Observability & Resilience

- **Telemetry:** Instrument API routes/agents with OpenTelemetry metrics, surface latency/error dashboards.
- **Protection layers:** Configure Vercel rate limiting, Supabase WAF rules, and retry/backoff in clients for transient faults.
- **Incident readiness:** Publish `codex/docs/incident-response.md`, define SLO alerts (failed PIN attempts, storage write errors, key rotation drift).

## Phase 5 – QA & Automation

- **Automated tests:** Extend Vitest suites for agents, orchestrator transitions, encryption helpers, and API route handlers.
- **E2E coverage:** Add Playwright flows for clinician login → full workflow; run against Supabase test schema in CI.
- **Contract tests:** Ensure frontend DTOs align with Zod schemas and Supabase migration columns.
- **CI pipeline:** Lint, unit/integration/E2E tests, `npm run build`, gitleaks, Vercel preview deploy, automated smoke tests.

## Phase 6 – Launch Prep

- **Performance validation:** Load-test Supabase writes and Vercel cold starts; optimize pooler configs and bundle sizes.
- **Deployment checklist:** Verify secrets, migrations, observability, and rollback plan before go/no-go.
- **Security review:** Complete threat model, dependency audit, pen test triage, and capture sign-offs.
- **Clinician onboarding:** Demo UX changes, gather feedback, and document support channels for triage.

Keep this document updated as tasks complete; reference it during standups, reviews, and future AI-collab sessions to maintain momentum.
