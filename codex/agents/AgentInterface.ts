import { AgentDependencies, AgentResult, AgentRunContext } from "./AgentContext.js";

export interface Agent<TInput = unknown, TOutput = unknown> {
  readonly name: string;
  readonly promptPath?: string;
  run(input: TInput, context: AgentRunContext): Promise<AgentResult<TOutput>>;
  isComplete?(context: AgentRunContext): boolean;
}

export type AgentFactory<TAgent extends Agent = Agent> = (
  dependencies: AgentDependencies
) => TAgent;
