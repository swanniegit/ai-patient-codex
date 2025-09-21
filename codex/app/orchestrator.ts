import { Orchestrator } from "../agents/Orchestrator.js";
import { StateMachine } from "../state/StateMachine.js";
import { SessionState } from "../state/transitions.js";
import { CaseRecord } from "../schemas/CaseRecord.js";
import { createAgentDependencies, DependencyOptions } from "./dependencies.js";
import { AgentDependencies } from "../agents/AgentContext.js";
import { createBioAgent } from "../agents/BioAgent.js";
import { createWoundImagingAgent } from "../agents/WoundImagingAgent.js";
import { createVitalsAgent } from "../agents/VitalsAgent.js";
import { createTimeAgent } from "../agents/TimeAgent.js";
import { createFollowupAgent } from "../agents/FollowupAgent.js";
import { createDataStewardAgent } from "../agents/DataStewardAgent.js";
import { createSecurityAgent } from "../agents/SecurityAgent.js";
import { createExportAgent } from "../agents/ExportAgent.js";
import { AgentFactory } from "../agents/AgentInterface.js";

export interface OrchestratorOptions extends DependencyOptions {
  initialState?: SessionState;
  dependencies?: AgentDependencies;
}

export const buildOrchestrator = (record: CaseRecord, options: OrchestratorOptions = {}) => {
  const dependencies = options.dependencies ?? createAgentDependencies(options);
  const initialState = options.initialState ?? "START";
  const machine = new StateMachine(record, initialState);

  const agentFactories: Partial<Record<SessionState, AgentFactory>> = {
    BIO_INTAKE: createBioAgent,
    WOUND_IMAGING: createWoundImagingAgent,
    VITALS: createVitalsAgent,
    TIME: createTimeAgent,
    FOLLOW_UP: createFollowupAgent,
    ASSEMBLE_JSON: createDataStewardAgent,
    LINK_TO_CLINICIAN: createSecurityAgent,
    STORE_SYNC: createExportAgent,
  };

  return new Orchestrator(machine, {
    agentFactories,
    dependencies,
  });
};
