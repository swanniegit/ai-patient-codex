import { Orchestrator } from "../agents/Orchestrator";
import { StateMachine } from "../state/StateMachine";
import { SessionState } from "../state/transitions";
import { CaseRecord } from "../schemas/CaseRecord";
import { createAgentDependencies, DependencyOptions } from "./dependencies";
import { AgentDependencies } from "../agents/AgentContext";
import { createBioAgent } from "../agents/BioAgent";
import { createWoundImagingAgent } from "../agents/WoundImagingAgent";
import { createVitalsAgent } from "../agents/VitalsAgent";
import { createTimeAgent } from "../agents/TimeAgent";
import { createFollowupAgent } from "../agents/FollowupAgent";
import { createDataStewardAgent } from "../agents/DataStewardAgent";
import { createSecurityAgent } from "../agents/SecurityAgent";
import { createExportAgent } from "../agents/ExportAgent";
import { AgentFactory } from "../agents/AgentInterface";

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
