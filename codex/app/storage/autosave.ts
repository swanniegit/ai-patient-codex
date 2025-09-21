import { CaseRecord } from "../../schemas/CaseRecord.js";
import { CaseRecordRepository } from "./types.js";

export const createAutosave = (repo: CaseRecordRepository) => {
  return async (draft: CaseRecord) => {
    await repo.save(draft);
  };
};
