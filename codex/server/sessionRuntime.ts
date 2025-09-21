import { CaseRecord } from "../schemas/CaseRecord";
import { SessionController } from "./sessionController";
import { CaseRecordRepository } from "../app/storage/types";
import { MemoryCaseRecordRepository } from "../app/storage/memoryRepository";
import { createBlankCaseRecord } from "../app/recordFactory";
import { createCaseRecordRepository } from "../app/storage/supabaseClient";

const MEMORY_REPO_MAP = Symbol.for("codex#memory-repositories");

interface RuntimeOptions {
  caseId?: string;
  repository?: CaseRecordRepository;
}

type GlobalCodexRuntime = typeof globalThis & {
  [MEMORY_REPO_MAP]?: Map<string, MemoryCaseRecordRepository>;
};

const getGlobalRuntime = (): GlobalCodexRuntime => globalThis as GlobalCodexRuntime;

const resolveCaseId = (options?: RuntimeOptions) => options?.caseId ?? "demo-case";

const resolveRepository = (caseId: string, options?: RuntimeOptions): CaseRecordRepository => {
  if (options?.repository) {
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

const loadRecord = async (caseId: string, repository: CaseRecordRepository): Promise<CaseRecord> => {
  try {
    const existing = await repository.fetchById(caseId);
    if (existing) {
      return existing;
    }
  } catch (error) {
    console.warn("Repository fetch failed, using blank record", { error });
  }
  return createBlankCaseRecord({ caseId });
};

export const createSessionController = async (options?: RuntimeOptions): Promise<SessionController> => {
  const caseId = resolveCaseId(options);
  const repository = resolveRepository(caseId, options);
  const record = await loadRecord(caseId, repository);
  return new SessionController(record, { repository });
};
