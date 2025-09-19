import { Agent } from "./AgentInterface";
import { AgentDependencies, AgentResult, AgentRunContext } from "./AgentContext";
import { CaseRecord } from "../schemas/CaseRecord";

export interface ExportAgentInput {
  destination?: string;
}

export interface ExportAgentOutput {
  success: boolean;
  destination?: string;
  missingEncryption?: string[];
}

const REQUIRED_ENCRYPTED_FIELDS = [
  "patient.firstName",
  "patient.lastName",
];

export class ExportAgent implements Agent<ExportAgentInput, ExportAgentOutput> {
  public readonly name = "ExportAgent";
  public readonly promptPath = "prompts/global.md";

  constructor(private readonly deps: AgentDependencies) {}

  async run(
    input: ExportAgentInput,
    context: AgentRunContext
  ): Promise<AgentResult<ExportAgentOutput>> {
    const record = context.record;
    this.deps.logger?.info("Export requested", { destination: input.destination });

    const missingEncryption = this.detectMissingEncryption(record);
    if (missingEncryption.length) {
      return {
        data: {
          success: false,
          destination: input.destination,
          missingEncryption,
        },
        followUps: missingEncryption.map((field) => `Encrypt field before export: ${field}`),
        provenance: [
          {
            agent: this.name,
            field: "export",
            timestamp: new Date().toISOString(),
            notes: "Export blocked pending encryption",
          },
        ],
      };
    }

    const destination = input.destination ?? "secure_store";
    const exportedRecord: CaseRecord = {
      ...record,
      status: "locked",
      updatedAt: new Date().toISOString(),
    };

    return {
      data: {
        success: true,
        destination,
      },
      updatedRecord: exportedRecord,
      provenance: [
        {
          agent: this.name,
          field: "export",
          timestamp: new Date().toISOString(),
          notes: `Record exported to ${destination} (placeholder)`
        },
      ],
    };
  }

  private detectMissingEncryption(record: CaseRecord): string[] {
    if (!record.encryptedFields) return REQUIRED_ENCRYPTED_FIELDS;
    return REQUIRED_ENCRYPTED_FIELDS.filter((field) => !record.encryptedFields[field]);
  }
}

export const createExportAgent = (deps: AgentDependencies) => new ExportAgent(deps);
