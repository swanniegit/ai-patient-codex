import { Agent } from "./AgentInterface";
import { AgentDependencies, AgentResult, AgentRunContext } from "./AgentContext";
import { PatientBio, ConsentPreferences } from "../schemas/PatientBio";

export interface BioAgentInput {
  patient: Partial<PatientBio>;
  consent: Partial<ConsentPreferences>;
}

export interface BioAgentOutput {
  patient: PatientBio;
  consentValidated: boolean;
  missingFields: string[];
}

export class BioAgent implements Agent<BioAgentInput, BioAgentOutput> {
  public readonly name = "BioAgent";
  public readonly promptPath = "prompts/bio.md";

  constructor(private readonly deps: AgentDependencies) {}

  async run(input: BioAgentInput, context: AgentRunContext): Promise<AgentResult<BioAgentOutput>> {
    const mergedPatient = this.mergePatient(context, input);
    const missing = this.computeMissingFields(mergedPatient);
    const consentValid = this.hasConsent(mergedPatient);

    const nextRecord = {
      ...context.record,
      patient: mergedPatient,
      consentGranted: consentValid,
      updatedAt: new Date().toISOString(),
    };

    if (context.autosave) {
      await context.autosave(nextRecord);
    }

    return {
      data: {
        patient: mergedPatient,
        consentValidated: consentValid,
        missingFields: missing,
      },
      updatedRecord: nextRecord,
      followUps: missing,
      provenance: [
        {
          agent: this.name,
          field: "patient",
          timestamp: new Date().toISOString(),
          notes: missing.length ? "Awaiting confirmation on missing demographic fields" : undefined,
        },
      ],
    };
  }

  isComplete(context: AgentRunContext): boolean {
    return this.computeMissingFields(context.record.patient).length === 0 && this.hasConsent(context.record.patient);
  }

  private mergePatient(context: AgentRunContext, input: BioAgentInput): PatientBio {
    const baseline = context.record.patient;
    const consent = {
      ...baseline.consent,
      ...input.consent,
    } as ConsentPreferences;

    const merged: PatientBio = {
      ...baseline,
      ...input.patient,
      consent,
    };

    return merged;
  }

  private computeMissingFields(patient: PatientBio): string[] {
    const missing: string[] = [];
    if (!patient.firstName && !patient.preferredName) missing.push("firstName or preferredName");
    if (!patient.dateOfBirth && patient.age === undefined) missing.push("dateOfBirth or age");
    if (!this.hasConsent(patient)) missing.push("consent");
    return missing;
  }

  private hasConsent(patient: PatientBio): boolean {
    const consent = patient.consent;
    return Boolean(consent && consent.dataStorage && consent.photography);
  }
}

export const createBioAgent = (deps: AgentDependencies) => new BioAgent(deps);
