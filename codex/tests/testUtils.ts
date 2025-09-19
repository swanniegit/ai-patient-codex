import { CaseRecord } from "../schemas/CaseRecord";

export const createStubCaseRecord = (overrides: Partial<CaseRecord> = {}): CaseRecord => ({
  caseId: "123e4567-e89b-12d3-a456-426614174000",
  clinicianId: "123e4567-e89b-12d3-a456-426614174001",
  clinicianPinHash: "hash",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  consentGranted: false,
  status: "draft",
  storageMeta: {
    version: 1,
    schema: "codex.wound.v1",
  },
  patient: {
    patientId: "123e4567-e89b-12d3-a456-426614174099",
    firstName: "Jane",
    lastName: "Doe",
    consent: {
      dataStorage: true,
      photography: true,
      sharingToTeamBoard: false,
    },
    notes: [],
  },
  wounds: {
    site: "left heel",
    description: "Baseline",
    photos: [],
  },
  followUps: [],
  artifacts: [],
  provenanceLog: [],
  encryptedFields: {},
  ...overrides,
});
