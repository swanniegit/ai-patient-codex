# Security & Deployment Blueprint

This document captures the target production posture for deploying the wound-care agent stack on **Vercel** (frontend/edge functions) and **Supabase** (Postgres + storage). The goal is to align encryption, authentication, and monitoring controls with privacy-first clinical requirements.

---

## 1. Environment Segmentation

| Stage | Vercel Environment | Supabase Project | Notes |
|-------|--------------------|------------------|-------|
| Development | `dev` | `supabase-dev` | Seed data anonymized; relaxed rate limits; test PINs only |
| Staging | `preview` | `supabase-stage` | Mirrors production schema; synthetic data or clinician-approved fixtures |
| Production | `production` | `supabase-prod` | Real PINs; audit logging enabled; incident response on-call |

*Each environment receives a unique Supabase service role key stored solely in Vercel encrypted env vars.*

---

## 2. Secrets & Key Management

### 2.1 Vercel Secrets
- Use `vercel env add` to inject secrets; only production env variables get populated via CI (no manual console edits).
- Secrets to define:
  - `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE`
  - `PIN_HASH_PEPPER` (random 64-byte base64 string)
  - `FIELD_ENCRYPTION_KEY` (AES-256-GCM key stored base64)
  - `SENTRY_DSN` (or other monitoring) when applicable

### 2.2 Supabase Secrets
- Enable Supabase **Vault** for server-side secrets (KMS-managed). Store:
  - `VERCEL_DEPLOY_HOOK` webhook secret for release automation
  - `EXPORT_WEBHOOK_TOKEN` for downstream sync targets

### 2.3 Key Rotation
- Rotate `FIELD_ENCRYPTION_KEY` every 90 days using envelope encryption:
  1. Generate new data key via Supabase Vault function.
  2. Re-encrypt stored fields asynchronously (background job) while maintaining version column.
  3. Update Vercel env var; redeploy; revoke old key.
- Maintain key version metadata in `storage_meta.version` within `CaseRecord`.

---

## 3. Data Encryption Strategy

### 3.1 At Rest (Database)
- Use **client-side encryption** for sensitive fields before sending to Supabase (enforced in the data steward/export layer):
  - `patient.firstName`, `patient.lastName`, `patient.contact.*`
  - `clinicianPinHash` (stored as Argon2 hash + pepper, no need to encrypt in addition)
  - Consent notes or free-text entries with potential PHI
- Implement AES-256-GCM with random IV per field; store IV + auth tag alongside ciphertext.
- Use deterministic hashing (SHA-256) of PII for search indexes when strictly required, stored in separate columns with `*_search_hash` naming convention.

### 3.2 In Transit
- Enforce TLS 1.2+ between Vercel Edge, browser clients, and Supabase.
- For mobile/offline clients, use TLS pinning where feasible and short-lived auth tokens (Supabase JWT exp ≤ 1 hour).

### 3.3 Backups
- Supabase automated backups remain encrypted. Restrict restore access to security engineer role. Document restore drill quarterly.

---

## 4. Authentication & Authorization

### 4.1 Clinician PIN Flow
- Store only Argon2id hash of PIN + per-user salt + global pepper.
- Rate limit PIN attempts via Supabase **edge functions** (e.g., max 5 attempts/15 min per clinician ID + IP).
- Enforce step-up verification (optional OTP) for higher-privilege actions (e.g., record export override).

### 4.2 Session Orchestrator Security
- Issue short-lived JWTs (Supabase auth) that embed clinician ID, environment, and consent scope claims.
- All agent invocations check `context.record.consentGranted`; if false, agents must bail without writing.
- Autosave hook writes via Supabase Row Level Security (RLS) policy restricting access to clinician's org + case ID.

### 4.3 Supabase RLS Policies
- RLS policies ensure only owning clinician (or delegated team via ACL table) can select/update rows.
- Use `provenance_log` to store actor ID, timestamp, and agent state for tamper detection.

---

## 5. Logging & Monitoring

- Send structured logs from agents and orchestrator to Vercel Log Drains (e.g., Datadog/Splunk).
- Mask PII in logs. Include `caseId`, `agentName`, `state`, `consentGranted` flag.
- Configure Supabase audit logging for table `case_records`, `artifacts`, `clinician_links`.
- Set up alerting for:
  - >3 failed PIN attempts for same clinician in 10 minutes
  - Data access outside clinician org scope
  - Export events without matching consent

---

## 6. Deployment Pipeline Controls

1. **CI (GitHub Actions)**
   - Run lint/unit/integration tests.
   - Trigger `vercel build --prod` dry run for preview branches.
   - Validate schema migrations via Supabase CLI (`supabase db diff`).

2. **Secrets Check**
   - Add pre-commit/CI rule to prevent hard-coded secrets (`gitleaks`).

3. **Infrastructure as Code**
   - Maintain Supabase configs (RLS policies, functions) in versioned SQL migrations.
   - Maintain Vercel project settings via `vercel.json` to ensure reproducibility.

---

## 7. Incident Response & Auditing

- Document escalation path (on-call clinician lead + security engineer).
- Maintain 30-day log retention with immutable backup (e.g., S3 + Object Lock).
- Quarterly security review checklist:
  - Key rotation executed
  - Access review for Supabase/Vercel collaborators
  - Pen-test / vulnerability scan results triaged

---

## 8. Open Questions

1. Should consent revocation trigger automatic data purge or soft-delete with legal hold?
2. What regulatory framework applies (HIPAA, GDPR)? Determine additional controls (BAA, DPA).
3. Will offline clients cache data locally? If yes, define local encryption and wipe policy.
4. Define maximum retention window for artifacts (images/audio) after case closure.

---

## 9. Next Implementation Steps

1. Wire client-side crypto helpers (AES-GCM + Argon2id) and integrate with DataSteward/Export agents via `EnvKeyCryptoProvider`.
2. Author Supabase RLS policies + SQL migrations for `case_records`, `artifacts`, `clinician_links` tables.
3. Build secure secrets bootstrap script for Vercel + Supabase environments.
4. Add logging middleware and alert pipeline to monitoring provider of choice.
5. Create incident response runbook in `/codex/docs/incident-response.md`.
