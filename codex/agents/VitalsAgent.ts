import { Agent } from "./AgentInterface";
import { AgentDependencies, AgentResult, AgentRunContext } from "./AgentContext";
import { Vitals } from "../schemas/Vitals";

type DeepPartial<T> = T extends (infer U)[]
  ? Array<DeepPartial<U>>
  : T extends object
    ? { [K in keyof T]?: DeepPartial<T[K]> }
    : T;

export interface VitalsAgentInput {
  vitals: DeepPartial<Vitals>;
}

export interface VitalsAgentOutput {
  vitals: Vitals;
  missingUnits: string[];
}

export class VitalsAgent implements Agent<VitalsAgentInput, VitalsAgentOutput> {
  public readonly name = "VitalsAgent";
  public readonly promptPath = "prompts/vitals.md";

  constructor(private readonly deps: AgentDependencies) {}

  async run(input: VitalsAgentInput, context: AgentRunContext): Promise<AgentResult<VitalsAgentOutput>> {
    const mergedVitals = {
      ...context.record.vitals,
      ...input.vitals,
    } as Vitals;

    const missingUnits = this.detectMissingUnits(mergedVitals);
    const followUps = missingUnits.map((key) => `Provide unit for ${key}`);

    const nextRecord = {
      ...context.record,
      vitals: mergedVitals,
      updatedAt: new Date().toISOString(),
    };

    if (context.autosave) {
      await context.autosave(nextRecord);
    }

    return {
      data: {
        vitals: mergedVitals,
        missingUnits,
      },
      updatedRecord: nextRecord,
      followUps,
      provenance: [
        {
          agent: this.name,
          field: "vitals",
          timestamp: new Date().toISOString(),
          notes: missingUnits.length ? "Unit clarification pending" : undefined,
        },
      ],
    };
  }

  private detectMissingUnits(vitals: Vitals): string[] {
    const missing: string[] = [];
    if (vitals.temperature && !vitals.temperature.unit) missing.push("temperature");
    if (vitals.bloodPressure && !vitals.bloodPressure.unit) missing.push("blood pressure");
    return missing;
  }
}

export const createVitalsAgent = (deps: AgentDependencies) => new VitalsAgent(deps);
