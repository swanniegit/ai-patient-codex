import { randomUUID } from "node:crypto";
import { CaseRecord } from "../schemas/CaseRecord.js";

const buildTimestamp = () => new Date().toISOString();

export const createBlankCaseRecord = (overrides: Partial<CaseRecord> = {}): CaseRecord => {
  const timestamp = buildTimestamp();

  return {
    caseId: randomUUID(),
    clinicianId: randomUUID(),
    clinicianPinHash: "pending",
    createdAt: timestamp,
    updatedAt: timestamp,
    consentGranted: false,
    status: "draft",
    storageMeta: {
      version: 1,
      schema: "codex.wound.v1",
      state: "BIO_INTAKE",
      pinIssuedAt: undefined,
    },
    patient: {
      consent: {
        dataStorage: false,
        photography: false,
        sharingToTeamBoard: false,
      },
      notes: [],
    },
    wounds: {
      photos: [],
    },
    vitals: undefined,
    time: undefined,
    followUps: [],
    artifacts: [],
    provenanceLog: [],
    encryptedFields: {},
    ...overrides,
  };
};
