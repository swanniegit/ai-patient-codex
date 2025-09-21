import { Agent } from "./AgentInterface.js";
import { AgentDependencies, AgentResult, AgentRunContext } from "./AgentContext.js";
import { TimeBlock } from "../schemas/TimeBlock.js";

export interface TimeAgentInput {
  time: Partial<TimeBlock>;
}

export interface TimeAgentOutput {
  time: TimeBlock;
  flags: string[];
}

export class TimeAgent implements Agent<TimeAgentInput, TimeAgentOutput> {
  public readonly name = "TimeAgent";
  public readonly promptPath = "prompts/time.md";

  constructor(private readonly deps: AgentDependencies) {}

  async run(input: TimeAgentInput, context: AgentRunContext): Promise<AgentResult<TimeAgentOutput>> {
    const merged = {
      ...context.record.time,
      ...input.time,
    } as TimeBlock;

    const flags = this.validateTimeBlock(merged);

    const nextRecord = {
      ...context.record,
      time: merged,
      updatedAt: new Date().toISOString(),
    };

    if (context.autosave) {
      await context.autosave(nextRecord);
    }

    return {
      data: {
        time: merged,
        flags,
      },
      updatedRecord: nextRecord,
      followUps: flags,
      provenance: [
        {
          agent: this.name,
          field: "time",
          timestamp: new Date().toISOString(),
          notes: flags.length ? "Awaiting clarification on TIME inputs" : undefined,
        },
      ],
    };
  }

  private validateTimeBlock(time: TimeBlock): string[] {
    const flags: string[] = [];
    const tissue = time.tissue;
    if (tissue) {
      const total =
        (tissue.granulationPct ?? 0) +
        (tissue.sloughPct ?? 0) +
        (tissue.necroticPct ?? 0) +
        (tissue.epithelialPct ?? 0);
      if (total > 100) {
        flags.push("Tissue percentages exceed 100%");
      }
    }
    if (!time.moisture?.exudate) {
      flags.push("Exudate level missing");
    }
    return flags;
  }
}

export const createTimeAgent = (deps: AgentDependencies) => new TimeAgent(deps);
