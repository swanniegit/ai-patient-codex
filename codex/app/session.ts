import { CaseRecord } from "../schemas/CaseRecord";
import { ArtifactRef } from "../schemas/ArtifactRef";
import { buildOrchestrator, OrchestratorOptions } from "./orchestrator";
import { createAgentDependencies } from "./dependencies";
import { CaseRecordRepository } from "./storage/types";
import { createAutosave } from "./storage/autosave";
import { AgentRunContext } from "../agents/AgentContext";

export interface SessionEnvironmentOptions extends OrchestratorOptions {
  repository?: CaseRecordRepository;
  artifacts?: ArtifactRef[];
}

export const createSessionEnvironment = (
  record: CaseRecord,
  options: SessionEnvironmentOptions = {}
) => {
  const dependencies = options.dependencies ?? createAgentDependencies(options);
  const orchestrator = buildOrchestrator(record, { ...options, dependencies });

  const context: AgentRunContext = {
    record,
    artifacts: options.artifacts ?? [],
    autosave: options.repository ? createAutosave(options.repository) : undefined,
    logger: dependencies.logger,
    cryptoProvider: dependencies.cryptoProvider,
  };

  return { orchestrator, context };
};
