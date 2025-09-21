import { describe, expect, it } from "vitest";
import { SessionController } from "../server/sessionController.js";
import { createSessionController, resetSessionRuntime } from "../server/sessionRuntime/index.js";
import { MemoryCaseRecordRepository } from "../app/storage/memoryRepository.js";
import { createBlankCaseRecord } from "../app/recordFactory.js";

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
    const existing = createBlankCaseRecord({ caseId: "11111111-2222-3333-4444-555555555555" });
    existing.patient.firstName = "Existing";
    existing.consentGranted = true;
    existing.clinicianId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
    await repository.save(existing);

    const controller = await createSessionController({
      caseId: "11111111-2222-3333-4444-555555555555",
      clinicianId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
      repository,
    });
    const snapshot = await controller.getSnapshot();

    expect(snapshot.record.caseId).toBe("11111111-2222-3333-4444-555555555555");
    expect(snapshot.record.patient.firstName).toBe("Existing");
  });

  it("throws when clinician does not own the case", async () => {
    const repository = new MemoryCaseRecordRepository();
    const existing = createBlankCaseRecord({
      caseId: "99999999-8888-7777-6666-555555555555",
      clinicianId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
    });
    await repository.save(existing);

    await expect(
      createSessionController({
        caseId: "99999999-8888-7777-6666-555555555555",
        clinicianId: "11111111-aaaa-bbbb-cccc-222222222222",
        repository,
      })
    ).rejects.toThrowError(/Clinician not authorized/);
  });
});
