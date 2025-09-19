import { CaseRecord } from "../schemas/CaseRecord";

describe("CaseRecord schema", () => {
  it("rejects TIME tissue totals over 100", () => {
    const invalid = {
      caseId: "123e4567-e89b-12d3-a456-426614174000",
      clinicianId: "123e4567-e89b-12d3-a456-426614174001",
      clinicianPinHash: "hash",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      patient: {
        patientId: "123e4567-e89b-12d3-a456-426614174099",
        consent: {
          dataStorage: true,
          photography: true,
          sharingToTeamBoard: false,
        },
        notes: [],
      },
      wounds: {
        photos: [],
      },
      time: {
        tissue: {
          granulationPct: 30,
          sloughPct: 40,
          necroticPct: 50,
          epithelialPct: 10,
        },
      },
      followUps: [],
      artifacts: [],
      provenanceLog: [],
      consentGranted: false,
      status: "draft",
      storageMeta: {
        version: 1,
        schema: "codex.wound.v1",
      },
    };

    const result = CaseRecord.safeParse(invalid);
    expect(result.success).toBe(false);
  });
});
