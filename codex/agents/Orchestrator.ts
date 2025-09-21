import { Agent } from "./AgentInterface.js";
import { AgentDependencies, AgentRunContext, AgentResult } from "./AgentContext.js";
import { StateMachine, StateSnapshot } from "../state/StateMachine.js";
import { SessionEvent, SessionState } from "../state/transitions.js";

export interface OrchestratorConfig {
  agentFactories: Partial<Record<SessionState, (deps: AgentDependencies) => Agent>>;
  dependencies: AgentDependencies;
}

export interface OrchestratorStepResult {
  snapshot: StateSnapshot;
  agentResult?: AgentResult<unknown>;
}

export class Orchestrator {
  private readonly agents: Partial<Record<SessionState, Agent>> = {};

  constructor(private readonly machine: StateMachine, private readonly config: OrchestratorConfig) {
    this.instantiateAgents(config.agentFactories);
  }

  get state(): StateSnapshot {
    return this.machine.current();
  }

  async advance(
    event: SessionEvent,
    input: unknown,
    context: AgentRunContext
  ): Promise<OrchestratorStepResult> {
    if (!this.machine.canTransition(event)) {
      throw new Error(`Cannot advance from ${this.machine.current().state} via ${event}`);
    }

    const snapshot = this.machine.transition(event);
    const agent = this.agents[snapshot.state];
    if (!agent) {
      return { snapshot };
    }

    const agentContext: AgentRunContext = {
      ...context,
      record: snapshot.record,
    };

    const result = await agent.run(input, agentContext);

    if (result.updatedRecord) {
      this.machine.reset(result.updatedRecord, snapshot.state);
    }

    return { snapshot: this.machine.current(), agentResult: result };
  }

  registerAgent(state: SessionState, factory: (deps: AgentDependencies) => Agent): void {
    this.agents[state] = factory(this.config.dependencies);
  }

  private instantiateAgents(factories: Partial<Record<SessionState, (deps: AgentDependencies) => Agent>>) {
    Object.entries(factories).forEach(([state, factory]) => {
      if (!factory) return;
      this.agents[state as SessionState] = factory(this.config.dependencies);
    });
  }
}
