import { CaseRecord } from "../schemas/CaseRecord.js";
import { ArtifactRef } from "../schemas/ArtifactRef.js";
import { buildOrchestrator, OrchestratorOptions } from "./orchestrator.js";
import { createAgentDependencies } from "./dependencies.js";
import { createCaseRecordRepository } from "./storage/supabaseClient.js";
import { CaseRecordRepository } from "./storage/types.js";
import { createAutosave } from "./storage/autosave.js";
import { AgentRunContext } from "../agents/AgentContext.js";

export interface SessionEnvironmentOptions extends OrchestratorOptions {
  repository?: CaseRecordRepository;
  artifacts?: ArtifactRef[];
}


const resolveRepository = (
  provided: CaseRecordRepository | undefined,
  logger: AgentRunContext["logger"]
): CaseRecordRepository | undefined => {
  if (provided) {
    return provided;
  }

  const hasSupabaseEnv = Boolean(process.env.SUPABASE_URL) &&
    Boolean(process.env.SUPABASE_SERVICE_ROLE ?? process.env.SUPABASE_ANON_KEY);
  if (!hasSupabaseEnv) {
    return undefined;
  }

  try {
    return createCaseRecordRepository();
  } catch (error) {
    logger?.warn?.("Supabase repository unavailable", { error });
    return undefined;
  }
};


export const createSessionEnvironment = (
  record: CaseRecord,
  options: SessionEnvironmentOptions = {}
) => {
  const dependencies = options.dependencies ?? createAgentDependencies(options);
  const initialState = record.storageMeta.state ?? options.initialState ?? "BIO_INTAKE";
  const repository = resolveRepository(options.repository, dependencies.logger);
  const orchestrator = buildOrchestrator(record, { ...options, dependencies, initialState });

  const context: AgentRunContext = {
    record,
    artifacts: options.artifacts ?? [],
    autosave: repository ? createAutosave(repository) : undefined,
    logger: dependencies.logger,
    cryptoProvider: dependencies.cryptoProvider,
  };

  return { orchestrator, context, repository };
};
