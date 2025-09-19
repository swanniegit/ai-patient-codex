import { CaseRecord } from "../../schemas/CaseRecord";
import { CaseRecordRepository } from "./types";

export const createAutosave = (repo: CaseRecordRepository) => {
  return async (draft: CaseRecord) => {
    await repo.save(draft);
  };
};
