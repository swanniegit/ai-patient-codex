import { Agent } from "./AgentInterface";
import { AgentDependencies, AgentResult, AgentRunContext } from "./AgentContext";
import { CaseRecord } from "../schemas/CaseRecord";
import { CryptoProvider } from "../crypto/types";

export interface DataStewardInput {
  draft?: CaseRecord;
}

export interface DataStewardOutput {
  record: CaseRecord;
  validationErrors: string[];
}

const SENSITIVE_FIELDS = [
  "patient.firstName",
  "patient.lastName",
  "patient.contact.phone",
  "patient.contact.email",
  "patient.contact.addressLine1",
];

export class DataStewardAgent implements Agent<DataStewardInput, DataStewardOutput> {
  public readonly name = "DataStewardAgent";
  public readonly promptPath = "prompts/steward.md";

  constructor(private readonly deps: AgentDependencies) {}

  async run(
    input: DataStewardInput,
    context: AgentRunContext
  ): Promise<AgentResult<DataStewardOutput>> {
    const candidate = input.draft ?? context.record;
    const parseResult = CaseRecord.safeParse(candidate);
    const validationErrors = parseResult.success
      ? []
      : parseResult.error.issues.map((issue) => issue.message);

    const record = parseResult.success ? parseResult.data : candidate;
    const status = validationErrors.length === 0 ? "ready_for_review" : "draft";

    const encryptedOutcome = context.cryptoProvider
      ? await this.encryptSensitive(record, context.cryptoProvider)
      : { record, encryptedFields: record.encryptedFields ?? {} };

    const nextRecord: CaseRecord = {
      ...encryptedOutcome.record,
      encryptedFields: {
        ...record.encryptedFields,
        ...encryptedOutcome.encryptedFields,
      },
      status,
      updatedAt: new Date().toISOString(),
    };

    if (context.autosave) {
      await context.autosave(nextRecord);
    }

    return {
      data: {
        record: nextRecord,
        validationErrors,
      },
      updatedRecord: nextRecord,
      followUps: validationErrors,
      provenance: [
        {
          agent: this.name,
          field: "record",
          timestamp: new Date().toISOString(),
          notes: validationErrors.length ? "Validation pending" : "Record ready for clinician review",
        },
      ],
    };
  }

  private async encryptSensitive(record: CaseRecord, crypto: CryptoProvider) {
    const encryptedFields: CaseRecord["encryptedFields"] = {};
    const nextRecord: CaseRecord = JSON.parse(JSON.stringify(record));

    await Promise.all(
      SENSITIVE_FIELDS.map(async (path) => {
        const value = this.getValueByPath(nextRecord, path);
        if (typeof value !== "string" || !value) return;
        const payload = await crypto.encrypt(value);
        encryptedFields[path] = payload;
        this.setValueByPath(nextRecord, path, undefined);
      })
    );

    return { record: nextRecord, encryptedFields };
  }

  private getValueByPath(obj: unknown, path: string): unknown {
    return path.split(".").reduce<unknown>((acc, key) => {
      if (acc && typeof acc === "object" && key in acc) {
        return (acc as Record<string, unknown>)[key];
      }
      return undefined;
    }, obj);
  }

  private setValueByPath(target: unknown, path: string, value: unknown): void {
    const segments = path.split(".");
    const last = segments.pop();
    if (!last) return;
    let cursor: any = target;
    for (const segment of segments) {
      if (!cursor[segment]) {
        cursor[segment] = {};
      }
      cursor = cursor[segment];
    }
    cursor[last] = value;
  }
}

export const createDataStewardAgent = (deps: AgentDependencies) => new DataStewardAgent(deps);
