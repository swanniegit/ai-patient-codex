# Compliance Decisions Pending

## 1. Consent Revocation Handling
- Does revocation require immediate soft-delete, irreversible purge, or archival with legal basis?
- How long must audit logs retain revoked entries?
- Should clinicians receive automated notifications upon revocation?

## 2. Regulatory Alignment
- Confirm whether HIPAA applies (US clinics) and if Business Associate Agreements are required.
- Determine GDPR obligations for EU data subjects (DSR workflows, data portability).
- Identify additional state/provincial privacy laws relevant to deployment regions.

## 3. Offline & Edge Clients
- Will clinicians capture data in offline mode? If yes:
  - Required encryption (device keystore, Secure Enclave, etc.).
  - Cache lifetime and wipe policy after sync.
  - Device attestation or MDM requirements.

## 4. Artifact Retention Policy
- Maximum retention window for wound images/audio once case is closed.
- Redaction workflow for identifiers in artifacts.
- Process for clinician-requested deletions vs. research retention.

## 5. Incident Response Commitments
- SLA for notifying clinicians/patients after breach detection.
- Authority matrix for declaring incidents.
- Checklist for regulatory reporting obligations.

## 6. Data Residency & Hosting
- Supabase region selection (US-EAST vs EU) per organization.
- Requirement for multi-region replication or data localization.
- Use of Vercel Edge regions and potential geo-fencing constraints.

## 7. Third-Party Integrations
- Any downstream exports (EHRs, analytics) requiring BAAs or DPAs?
- Encryption requirements for webhook payloads.
- Consent scope for sharing to team boards or external partners.
