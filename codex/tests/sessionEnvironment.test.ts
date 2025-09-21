import { createSessionEnvironment } from "../app/session.js";
import { createStubCaseRecord } from "./testUtils.js";
import { CaseRecordRepository } from "../app/storage/types.js";

const repo: CaseRecordRepository = {
  save: async () => undefined,
  fetchById: async () => null,
};

describe("createSessionEnvironment", () => {
  it("provides orchestrator and context with autosave", () => {
    process.env.FIELD_ENCRYPTION_KEY = Buffer.alloc(32, 4).toString("base64");
    const record = createStubCaseRecord();
    const { orchestrator, context } = createSessionEnvironment(record, { repository: repo });
    expect(orchestrator.state.state).toBe("BIO_INTAKE");
    expect(typeof context.autosave).toBe("function");
  });
});
