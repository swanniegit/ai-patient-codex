````markdown
# AGENTS.md — Wound-Care Patient App (Agentic Flow)

> **Purpose**  
> A privacy-first, clinician-guided agent system that captures wound-care data step-by-step, validates inputs, and stores a single, structured JSON record per case.  
> **Hard rule:** Agents **NEVER** give medical advice. They can collect information, ask neutral follow-ups, summarize, and suggest posting to the team chat/board for clinical discussion.

---

## 1. Design Principles

- **Clinician-in-the-loop:** Every step is confirmable/editable; agents propose, clinicians approve.  
- **Evidence-based inputs, not advice:** Agents request facts, clarify ambiguity, and stop short of recommendations.  
- **Bias to structure:** All outputs converge into one JSON schema (`CaseRecord`).  
- **Privacy & consent by default:** Minimize PII, encrypt at rest, and bind cases to clinicians via a **private PIN**.  
- **Robust on low signal:** Handle noisy images, partial demographics, offline mode, and retries gracefully.  
- **Traceability:** Every field includes `provenance` (who/what filled it, when, and with which artifact).  

---

## 2. Agent Roster

1. **Session Orchestrator** — controls the flow and state machine.  
2. **Identity & Consent Agent (BIO Intake)** — gathers patient demographics + consent.  
3. **OCR & Transcription Agent** — extracts text/audio data with confidence scores.  
4. **Wound Imaging QA Agent** — checks clarity, confirms scale, requests retakes.  
5. **Vitals Agent** — collects structured vitals with units and timestamps.  
6. **T.I.M.E Agent** — captures Tissue, Infection/Inflammation, Moisture, Edge.  
7. **Follow-up Questioning Agent** — resolves missing/contradictory fields only.  
8. **Data Steward & JSON Assembler** — validates and outputs `CaseRecord`.  
9. **Security & PIN Linker** — binds records to clinician via PIN.  
10. **Export & Sync Agent** — stores securely and emits event hooks.  

---

## 3. State Machine

```text
START
 ├─▶ BIO_INTAKE
 ├─▶ WOUND_IMAGING
 ├─▶ VITALS
 ├─▶ TIME
 ├─▶ FOLLOW_UP
 ├─▶ REVIEW
 ├─▶ ASSEMBLE_JSON
 ├─▶ LINK_TO_CLINICIAN
 └─▶ STORE/SYNC → DONE
````

* **Recoverability:** Any state can roll back.
* **Autosave:** Snapshot `CaseRecord` at each step.

---

## 4. Input/Output Contracts

* **Artifacts** carry metadata about input sources.
* **PatientBio, WoundPhoto, Vitals, TIMEBlock** are structured deltas.
* **CaseRecord** is the final schema (JSON).

---

## 5. Guardrails

* **No advice:** Always redirect to the team chat board.
* **Neutral follow-ups only.**
* **Consent required** before storage/export.
* **Ambiguity handled** via dropdowns/scales.
* **PII minimized** and redacted in summaries.

---

## 6. Prompt Templates

**Global preamble:**

```
You are a data-collection assistant for a wound-care app.
You MUST NOT provide clinical advice or recommendations.
Capture inputs, ask neutral clarifications, and assemble JSON CaseRecords.
```

* **BIO Agent:** Extract patient demographics + consent.
* **Imaging QA:** Validate clarity, scale, identifiers.
* **Vitals Agent:** Record vitals with units, no interpretation.
* **T.I.M.E Agent:** Capture structured wound details.
* **Follow-up Agent:** Ask only for missing/contradictory fields.
* **Data Steward:** Assemble/validate JSON, attach provenance.

---

## 7. Image QA Checklist

* Framing (whole wound visible)
* Focus (no blur)
* Lighting (even, no glare)
* Scale (ruler/grid, else confirm estimated)
* Optional patient/date tag

---

## 8. Example Flow

* **BIO via label image:** OCR → “Detected: Jane Doe (93%). Confirm?”
* **Wound photo without scale:** → “No scale detected. Proceed with estimated size?”
* **Follow-up:** → “Missing exudate level. Options: none/scant/moderate/heavy.”

---

## 9. Storage & Security

* **Supabase/Postgres** with row-level security.
* **PIN binding** via `pin_hash`.
* **Artifacts table** for image/audio references.
* **Audit log** in provenance.
* **PII minimization** enforced.

---

## 10. Validation Rules

* Birthdate vs. age consistency.
* Units required for vitals.
* TIME % totals ≤ 100.
* At least one valid wound image or clinician override.

---

## 11. Definition of Done

* [ ] Agents callable with system prompts
* [ ] State machine transitions + autosave
* [ ] JSON schema validation + versioning
* [ ] PIN login & RLS enforcement
* [ ] Imaging QA with automated checks
* [ ] Consent enforcement
* [ ] Redacted chat summary endpoint
* [ ] Test matrix passes edge cases

---

## 12. Redacted Chat Summary Example

```
Case: {case_id_short} • Site: {site} • {N} photos
TIME: T[{granulation/slough/necrotic %}] I[{exudate}] M[{dryness}] E[{edge flags}]
Vitals: BP {sys}/{dia}, HR {hr}, Temp {temp_c}°C
Notes: {neutral notes}
(No clinical advice provided.)
```

---

**Schema Version:** `codex.wound.v1`
**Status:** Draft 1.0

```

---

Would you like me to also scaffold this into a **repo-ready folder structure** (e.g., `/agents/BioAgent.ts`, `/agents/WoundQAAgent.ts`, `/schemas/CaseRecord.ts`), or do you just want the markdown doc for now?
```

