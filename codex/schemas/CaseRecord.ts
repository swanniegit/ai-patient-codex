import { z } from "zod";
import { ArtifactRef } from "./ArtifactRef.js";
import { PatientBio } from "./PatientBio.js";
import { TimeBlock } from "./TimeBlock.js";
import { Vitals } from "./Vitals.js";
import { WoundPhoto } from "./WoundPhoto.js";
import { SESSION_STATES } from "../state/transitions.js";

export const EncryptedField = z.object({
  ciphertext: z.string(),
  iv: z.string(),
  authTag: z.string(),
  keyVersion: z.number().min(1),
});

export const ProvenanceEntry = z.object({
  agent: z.string(),
  field: z.string(),
  timestamp: z.string().datetime(),
  artifactId: z.string().optional(),
  notes: z.string().optional(),
});

export const FollowUpItem = z.object({
  question: z.string(),
  answer: z.string().optional(),
  status: z.enum(["pending", "resolved", "dismissed"]).default("pending"),
  timestamp: z.string().datetime(),
});

export const WoundSection = z.object({
  site: z.string().optional(),
  description: z.string().optional(),
  photos: z.array(WoundPhoto),
  overrides: z
    .object({
      requiresRetake: z.boolean().optional(),
      clinicianOverride: z.string().optional(),
    })
    .optional(),
});

const StorageMeta = z
  .object({
    version: z.number().default(1),
    schema: z.string().default("codex.wound.v1"),
    state: z.enum(SESSION_STATES).optional(),
  })
  .transform((meta) => ({
    version: meta.version ?? 1,
    schema: meta.schema ?? "codex.wound.v1",
    state: meta.state ?? "BIO_INTAKE",
  }));

export const CaseRecord = z.object({
  caseId: z.string().uuid(),
  clinicianId: z.string().uuid(),
  clinicianPinHash: z.string().min(1),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  patient: PatientBio,
  wounds: WoundSection,
  vitals: Vitals.optional(),
  time: TimeBlock.optional(),
  followUps: z.array(FollowUpItem).default([]),
  artifacts: z.array(ArtifactRef).default([]),
  provenanceLog: z.array(ProvenanceEntry).default([]),
  consentGranted: z.boolean().default(false),
  status: z.enum(["draft", "ready_for_review", "locked"]).default("draft"),
  storageMeta: StorageMeta,
  encryptedFields: z.record(EncryptedField).default({}),
});

export type CaseRecord = z.infer<typeof CaseRecord>;
export type FollowUpItem = z.infer<typeof FollowUpItem>;
export type ProvenanceEntry = z.infer<typeof ProvenanceEntry>;
export type WoundSection = z.infer<typeof WoundSection>;
export type EncryptedField = z.infer<typeof EncryptedField>;
