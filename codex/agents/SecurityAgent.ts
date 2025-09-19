import { Agent } from "./AgentInterface";
import { AgentDependencies, AgentResult, AgentRunContext } from "./AgentContext";

export interface SecurityAgentInput {
  clinicianId: string;
  pinHash: string;
}

export interface SecurityAgentOutput {
  clinicianId: string;
  pinHash: string;
  linked: boolean;
}

export class SecurityAgent implements Agent<SecurityAgentInput, SecurityAgentOutput> {
  public readonly name = "SecurityAgent";
  public readonly promptPath = "prompts/security.md";

  constructor(private readonly deps: AgentDependencies) {}

  async run(
    input: SecurityAgentInput,
    context: AgentRunContext
  ): Promise<AgentResult<SecurityAgentOutput>> {
    const updatedRecord = {
      ...context.record,
      clinicianId: input.clinicianId,
      clinicianPinHash: input.pinHash,
      updatedAt: new Date().toISOString(),
    };

    if (context.autosave) {
      await context.autosave(updatedRecord);
    }

    return {
      data: {
        clinicianId: input.clinicianId,
        pinHash: input.pinHash,
        linked: true,
      },
      updatedRecord,
      provenance: [
        {
          agent: this.name,
          field: "clinicianPinHash",
          timestamp: new Date().toISOString(),
          notes: "Clinician PIN linked; no clinical advice provided.",
        },
      ],
    };
  }
}

export const createSecurityAgent = (deps: AgentDependencies) => new SecurityAgent(deps);
