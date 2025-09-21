import { CaseRecord } from "../../schemas/CaseRecord.js";

export interface CaseRecordRepository {
  save(record: CaseRecord): Promise<void>;
  fetchById(caseId: string): Promise<CaseRecord | null>;
}

export interface RepositoryResult<T = unknown> {
  data: T | null;
  error?: Error;
}

export interface SupabaseFromBuilder {
  upsert(value: Record<string, unknown>, options?: Record<string, unknown>): Promise<{ data: unknown; error: Error | null }>;
  select(columns?: string): {
    eq(column: string, value: unknown): Promise<{ data: Array<Record<string, unknown>> | null; error: Error | null }>;
  };
}

export interface SupabaseClientLike {
  from(table: string): SupabaseFromBuilder;
}
