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
    const stamped = unresolved.map((item) => ({
      ...item,
      question: this.ensureNeutralTone(item.question),
      timestamp: new Date().toISOString(),
    }));

    const questions = await this.normalizeWithLlm(stamped, context);

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

  private async normalizeWithLlm(items: FollowUpItem[], context: AgentRunContext): Promise<FollowUpItem[]> {
    if (!this.deps.llm || items.length === 0 || !this.promptPath) {
      return items;
    }

    try {
      const systemPrompt = await this.deps.promptLoader.load(this.promptPath);
      const payload = JSON.stringify({ questions: items.map((item) => item.question) });
      const instruction = 'Rewrite these follow-up questions in a neutral, clinician-review tone. Respond with a JSON object {"questions": string[]} matching the provided order. Do not add advice. Questions: ';
      const response = await this.deps.llm.generate({
        systemPrompt,
        input: instruction + payload,
        temperature: 0.2,
        maxOutputTokens: 256,
      });

      const parsed = this.parseLlmResponse(response.text);
      if (!parsed) {
        return items;
      }

      return items.map((item, index) => {
        const candidate = parsed[index];
        const rewritten = typeof candidate === "string" ? candidate.trim() : "";
        const question = rewritten ? this.ensureNeutralTone(rewritten) : item.question;
        return { ...item, question };
      });
    } catch (error) {
      context.logger?.warn?.("LLM normalization failed", { error });
      return items;
    }
  }

  private parseLlmResponse(output: string): string[] | null {
    if (!output) return null;
    const trimmed = output.trim();
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed;
      }
      if (parsed && typeof parsed === "object") {
        const candidate = (parsed as { questions?: unknown }).questions;
        if (Array.isArray(candidate)) {
          return candidate.filter((entry): entry is string => typeof entry === "string");
        }
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  private ensureNeutralTone(question: string): string {
    if (question.endsWith("?")) return question;
    return `${question}?`;
  }
}

export const createFollowupAgent = (deps: AgentDependencies) => new FollowupAgent(deps);
