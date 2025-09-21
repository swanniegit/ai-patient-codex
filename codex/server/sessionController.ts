import { AgentRunContext } from "../agents/AgentContext";
import { BioAgentInput, BioAgentOutput, createBioAgent } from "../agents/BioAgent";
import { CaseRecord } from "../schemas/CaseRecord";
import { createAgentDependencies } from "../app/dependencies";
import { createSessionEnvironment } from "../app/session";
import { createBlankCaseRecord } from "../app/recordFactory";
import { ConsentPreferences, PatientBio } from "../schemas/PatientBio";
import { CaseRecordRepository } from "../app/storage/types";

interface SessionControllerOptions {
  repository?: CaseRecordRepository;
}

interface SessionSnapshot {
  record: CaseRecord;
  bio: BioAgentOutput;
  state: "BIO_INTAKE" | "BIO_COMPLETE";
}

export class SessionController {
  private context: AgentRunContext;
  private record: CaseRecord;
  private bioResult: BioAgentOutput | null = null;
  private state: SessionSnapshot["state"] = "BIO_INTAKE";

  private readonly bioAgent: ReturnType<typeof createBioAgent>;

  constructor(record?: CaseRecord, options: SessionControllerOptions = {}) {
    this.record = record ?? createBlankCaseRecord();
    const dependencies = createAgentDependencies({});
    this.bioAgent = createBioAgent(dependencies);

    const { context } = createSessionEnvironment(this.record, {
      initialState: "BIO_INTAKE",
      dependencies,
      repository: options.repository,
    });
    this.context = context;
    this.context.record = this.record;
  }

  async getSnapshot(): Promise<SessionSnapshot> {
    if (!this.bioResult) {
      await this.updateBio({ patient: {}, consent: {} });
    }

    return {
      record: this.record,
      bio: this.bioResult as BioAgentOutput,
      state: this.state,
    };
  }

  async updateBio(rawInput: BioAgentInput): Promise<SessionSnapshot> {
    const input = this.sanitizeInput(rawInput);
    this.context.record = this.record;
    const result = await this.bioAgent.run(input, this.context);

    if (result.updatedRecord) {
      this.record = result.updatedRecord;
      this.context.record = result.updatedRecord;
    }

    this.bioResult = result.data;
    return {
      record: this.record,
      bio: result.data,
      state: this.state,
    };
  }

  async confirmBio(): Promise<{ ok: boolean; missingFields: string[] }> {
    if (!this.bioResult) {
      await this.updateBio({ patient: {}, consent: {} });
    }

    const missing = this.bioResult?.missingFields ?? [];
    const consentValidated = this.bioResult?.consentValidated ?? false;

    if (missing.length || !consentValidated) {
      return { ok: false, missingFields: missing };
    }

    this.state = "BIO_COMPLETE";
    return { ok: true, missingFields: [] };
  }

  private sanitizeInput(input: BioAgentInput): BioAgentInput {
    return {
      patient: this.cleanPatient(input.patient),
      consent: this.cleanConsent(input.consent),
    };
  }

  private cleanPatient(patient: Partial<PatientBio>): Partial<PatientBio> {
    const cleaned: Partial<PatientBio> = {};

    if ("firstName" in patient) {
      cleaned.firstName = this.normalizeString(patient.firstName);
    }

    if ("lastName" in patient) {
      cleaned.lastName = this.normalizeString(patient.lastName);
    }

    if ("preferredName" in patient) {
      cleaned.preferredName = this.normalizeString(patient.preferredName);
    }

    if ("dateOfBirth" in patient) {
      cleaned.dateOfBirth = this.normalizeString(patient.dateOfBirth);
    }

    if ("age" in patient) {
      const value = typeof patient.age === "number" ? patient.age : Number(patient.age);
      cleaned.age = Number.isFinite(value) ? value : undefined;
    }

    if ("sex" in patient) {
      cleaned.sex = patient.sex;
    }

    if ("mrn" in patient) {
      cleaned.mrn = this.normalizeString(patient.mrn);
    }

    if ("notes" in patient) {
      const candidate = patient.notes as unknown;
      if (Array.isArray(candidate)) {
        cleaned.notes = candidate
          .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
          .filter((entry) => entry.length > 0);
      } else if (typeof candidate === "string") {
        cleaned.notes = candidate
          .split("\n")
          .map((line) => line.trim())
          .filter((line) => line.length > 0);
      } else {
        cleaned.notes = [];
      }
    }

    return cleaned;
  }

  private cleanConsent(consent: Partial<ConsentPreferences>): Partial<ConsentPreferences> {
    const cleaned: Partial<ConsentPreferences> = {};

    if ("dataStorage" in consent) {
      cleaned.dataStorage = Boolean(consent.dataStorage);
    }

    if ("photography" in consent) {
      cleaned.photography = Boolean(consent.photography);
    }

    if ("sharingToTeamBoard" in consent) {
      cleaned.sharingToTeamBoard = Boolean(consent.sharingToTeamBoard);
    }

    if ("notes" in consent) {
      cleaned.notes = this.normalizeString(consent.notes);
    }

    return cleaned;
  }

  private normalizeString(value: string | undefined | null): string | undefined {
    if (typeof value !== "string") return undefined;
    const trimmed = value.trim();
    return trimmed.length ? trimmed : undefined;
  }
}
