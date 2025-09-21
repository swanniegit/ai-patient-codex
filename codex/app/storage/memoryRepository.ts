import { CaseRecord } from "../../schemas/CaseRecord";
import { CaseRecordRepository } from "./types";

const cloneRecord = (record: CaseRecord): CaseRecord => JSON.parse(JSON.stringify(record));

export class MemoryCaseRecordRepository implements CaseRecordRepository {
  private readonly store = new Map<string, CaseRecord>();

  async save(record: CaseRecord): Promise<void> {
    this.store.set(record.caseId, cloneRecord(record));
  }

  async fetchById(caseId: string): Promise<CaseRecord | null> {
    const record = this.store.get(caseId);
    return record ? cloneRecord(record) : null;
  }
}

export const createMemoryRepository = () => new MemoryCaseRecordRepository();
