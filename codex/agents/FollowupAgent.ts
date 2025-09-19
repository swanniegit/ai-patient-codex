import { Agent } from "./AgentInterface";
import { AgentDependencies, AgentResult, AgentRunContext } from "./AgentContext";
import { FollowUpItem } from "../schemas/CaseRecord";

export interface FollowupAgentInput {
  openItems: FollowUpItem[];
}

export interface FollowupAgentOutput {
  questions: FollowUpItem[];
}

export class FollowupAgent implements Agent<FollowupAgentInput, FollowupAgentOutput> {
  public readonly name = "FollowupAgent";
  public readonly promptPath = "prompts/followup.md";

  constructor(private readonly deps: AgentDependencies) {}

  async run(
    input: FollowupAgentInput,
    context: AgentRunContext
  ): Promise<AgentResult<FollowupAgentOutput>> {
    const unresolved = input.openItems.filter((item) => item.status === "pending");
    const questions = unresolved.map((item) => ({
      ...item,
      question: this.ensureNeutralTone(item.question),
      timestamp: new Date().toISOString(),
    }));

    const nextRecord = {
      ...context.record,
      followUps: questions,
      updatedAt: new Date().toISOString(),
    };

    if (context.autosave) {
      await context.autosave(nextRecord);
    }

    return {
      data: { questions },
      updatedRecord: nextRecord,
      followUps: questions.map((q) => q.question),
      provenance: [
        {
          agent: this.name,
          field: "followUps",
          timestamp: new Date().toISOString(),
          notes: "Neutral follow-up questions generated",
        },
      ],
    };
  }

  private ensureNeutralTone(question: string): string {
    if (question.endsWith("?")) return question;
    return `${question}?`;
  }
}

export const createFollowupAgent = (deps: AgentDependencies) => new FollowupAgent(deps);
