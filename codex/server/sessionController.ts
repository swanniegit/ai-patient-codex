import { AgentRunContext } from "../agents/AgentContext.js";
import { BioAgentInput, BioAgentOutput, createBioAgent } from "../agents/BioAgent.js";
import { CaseRecord } from "../schemas/CaseRecord.js";
import { createAgentDependencies } from "../app/dependencies.js";
import { createSessionEnvironment } from "../app/session.js";
import { createBlankCaseRecord } from "../app/recordFactory.js";
import { ConsentPreferences, PatientBio } from "../schemas/PatientBio.js";
import { CaseRecordRepository } from "../app/storage/types.js";
import { SessionEvent, SessionState, stateTransitions } from "../state/transitions.js";

interface SessionControllerOptions {
  repository?: CaseRecordRepository;
}

interface SessionSnapshot {
  record: CaseRecord;
  bio: BioAgentOutput;
  state: SessionState;
}

export class SessionController {
  private context: AgentRunContext;
  private record: CaseRecord;
  private bioResult: BioAgentOutput | null = null;
  private state: SessionState;

  private readonly bioAgent: ReturnType<typeof createBioAgent>;

  constructor(record?: CaseRecord, options: SessionControllerOptions = {}) {
    this.record = record ?? createBlankCaseRecord();
    const dependencies = createAgentDependencies({});
    this.bioAgent = createBioAgent(dependencies);

    this.state = this.resolveInitialState(this.record);

    const { context } = createSessionEnvironment(this.record, {
      initialState: this.state,
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

    return this.snapshot();
  }

  async updateBio(rawInput: BioAgentInput): Promise<SessionSnapshot> {
    const input = this.sanitizeInput(rawInput);
    this.context.record = this.record;
    const result = await this.bioAgent.run(input, this.context);

    if (result.updatedRecord) {
      this.record = {
        ...result.updatedRecord,
        storageMeta: {
          ...result.updatedRecord.storageMeta,
          state: this.state,
        },
      };
      this.context.record = this.record;
    }

    this.bioResult = result.data;
    return this.snapshot();
  }

  async confirmBio(): Promise<{ ok: boolean; missingFields: string[]; state: SessionState }> {
    if (!this.bioResult) {
      await this.updateBio({ patient: {}, consent: {} });
    }

    const missing = this.bioResult?.missingFields ?? [];
    const consentValidated = this.bioResult?.consentValidated ?? false;

    if (missing.length || !consentValidated) {
      return { ok: false, missingFields: missing, state: this.state };
    }

    await this.transitionState("BIO_CONFIRMED");
    return { ok: true, missingFields: [], state: this.state };
  }

  async triggerEvent(event: SessionEvent): Promise<SessionSnapshot> {
    return this.transitionState(event);
  }

  async assignPin(hash: string, issuedAt: string): Promise<SessionSnapshot> {
    this.record = {
      ...this.record,
      clinicianPinHash: hash,
      storageMeta: {
        ...this.record.storageMeta,
        pinIssuedAt: issuedAt,
      },
      updatedAt: issuedAt,
    };
    this.context.record = this.record;
    if (this.context.autosave) {
      await this.context.autosave(this.record);
    }
    return this.snapshot();
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

  private resolveInitialState(record: CaseRecord): SessionState {
    const stored = record.storageMeta.state ?? "BIO_INTAKE";
    return stored === "START" ? "BIO_INTAKE" : stored;
  }

  private snapshot(): SessionSnapshot {
    return {
      record: this.record,
      bio: this.bioResult as BioAgentOutput,
      state: this.state,
    };
  }

  private async transitionState(event: SessionEvent): Promise<SessionSnapshot> {
    const nextState = stateTransitions[this.state]?.[event];
    if (!nextState) {
      throw new Error(`Cannot transition from ${this.state} using ${event}`);
    }

    if (this.state === nextState) {
      return this.snapshot();
    }

    const updatedAt = new Date().toISOString();
    this.record = {
      ...this.record,
      updatedAt,
      storageMeta: {
        ...this.record.storageMeta,
        state: nextState,
      },
    };

    this.context.record = this.record;
    this.state = nextState;

    if (this.context.autosave) {
      await this.context.autosave(this.record);
    }

    return this.snapshot();
  }
}
