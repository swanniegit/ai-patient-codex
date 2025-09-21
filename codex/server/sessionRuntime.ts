import { CaseRecord } from "../schemas/CaseRecord";
import { SessionController } from "./sessionController";
import { CaseRecordRepository } from "../app/storage/types";
import { MemoryCaseRecordRepository } from "../app/storage/memoryRepository";
import { createBlankCaseRecord } from "../app/recordFactory";
import { createCaseRecordRepository } from "../app/storage/supabaseClient";
import { UnauthorizedAccessError } from "./errors";

const MEMORY_REPO_MAP = Symbol.for("codex#memory-repositories");

export interface RuntimeOptions {
  caseId: string;
  clinicianId: string;
  repository?: CaseRecordRepository;
}

type GlobalCodexRuntime = typeof globalThis & {
  [MEMORY_REPO_MAP]?: Map<string, MemoryCaseRecordRepository>;
};

const getGlobalRuntime = (): GlobalCodexRuntime => globalThis as GlobalCodexRuntime;

const resolveRepository = (caseId: string, options: RuntimeOptions): CaseRecordRepository => {
  if (options.repository) {
    return options.repository;
  }

  const hasSupabaseEnv = Boolean(process.env.SUPABASE_URL) &&
    Boolean(process.env.SUPABASE_SERVICE_ROLE ?? process.env.SUPABASE_ANON_KEY);

  if (hasSupabaseEnv) {
    try {
      return createCaseRecordRepository();
    } catch (error) {
      console.warn("Falling back to in-memory repository", { error });
    }
  }

  const runtime = getGlobalRuntime();
  if (!runtime[MEMORY_REPO_MAP]) {
    runtime[MEMORY_REPO_MAP] = new Map();
  }
  const map = runtime[MEMORY_REPO_MAP]!;
  if (!map.has(caseId)) {
    map.set(caseId, new MemoryCaseRecordRepository());
  }
  return map.get(caseId)!;
};

const loadRecord = async (
  caseId: string,
  clinicianId: string,
  repository: CaseRecordRepository
): Promise<CaseRecord> => {
  try {
    const existing = await repository.fetchById(caseId);
    if (existing) {
      if (existing.clinicianId !== clinicianId) {
        throw new UnauthorizedAccessError();
      }
      return existing;
    }
  } catch (error) {
    if (error instanceof UnauthorizedAccessError) {
      throw error;
    }
    console.warn("Repository fetch failed, using blank record", { error });
  }

  const record = createBlankCaseRecord({ caseId, clinicianId });
  try {
    await repository.save(record);
  } catch (error) {
    console.warn("Failed to persist initial record", { error });
  }
  return record;
};

export const createSessionController = async (options: RuntimeOptions): Promise<SessionController> => {
  const repository = resolveRepository(options.caseId, options);
  const record = await loadRecord(options.caseId, options.clinicianId, repository);
  return new SessionController(record, { repository });
};

export const resetSessionRuntime = () => {
  const runtime = getGlobalRuntime();
  runtime[MEMORY_REPO_MAP]?.clear();
};
