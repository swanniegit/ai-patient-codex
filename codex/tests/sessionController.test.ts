import { describe, expect, it } from "vitest";
import { SessionController } from "../server/sessionController";
import { createSessionController, resetSessionRuntime } from "../server/sessionRuntime/index.js";
import { MemoryCaseRecordRepository } from "../app/storage/memoryRepository";
import { createBlankCaseRecord } from "../app/recordFactory";

describe("SessionController", () => {
  beforeEach(() => {
    resetSessionRuntime();
  });

  it("captures patient updates and narrows missing fields", async () => {
    const controller = new SessionController();

    const initial = await controller.getSnapshot();
    expect(initial.bio.missingFields).toContain("firstName or preferredName");

    await controller.updateBio({
      patient: { firstName: "Ada" },
      consent: { photography: true, dataStorage: true },
    });

    const after = await controller.getSnapshot();
    expect(after.record.patient.firstName).toBe("Ada");
    expect(after.bio.missingFields).not.toContain("firstName or preferredName");
  });

  it("clears values when empty strings are submitted", async () => {
    const controller = new SessionController();

    await controller.updateBio({
      patient: { preferredName: "Nightingale" },
      consent: {},
    });

    await controller.updateBio({
      patient: { preferredName: "" },
      consent: {},
    });

    const snapshot = await controller.getSnapshot();
    expect(snapshot.record.patient.preferredName).toBeUndefined();
  });

  it("hydrates controller from repository when record exists", async () => {
    const repository = new MemoryCaseRecordRepository();
    const existing = createBlankCaseRecord({ caseId: "case-123" });
    existing.patient.firstName = "Existing";
    existing.consentGranted = true;
    existing.clinicianId = "clinician-1";
    await repository.save(existing);

    const controller = await createSessionController({ caseId: "case-123", clinicianId: "clinician-1", repository });
    const snapshot = await controller.getSnapshot();

    expect(snapshot.record.caseId).toBe("case-123");
    expect(snapshot.record.patient.firstName).toBe("Existing");
  });

  it("throws when clinician does not own the case", async () => {
    const repository = new MemoryCaseRecordRepository();
    const existing = createBlankCaseRecord({ caseId: "case-unauth", clinicianId: "clinician-owner" });
    await repository.save(existing);

    await expect(
      createSessionController({ caseId: "case-unauth", clinicianId: "clinician-other", repository })
    ).rejects.toThrowError(/Clinician not authorized/);
  });
});
