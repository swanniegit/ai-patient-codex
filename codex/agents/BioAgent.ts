import { Agent } from "./AgentInterface.js";
import { AgentDependencies, AgentResult, AgentRunContext } from "./AgentContext.js";
import { PatientBio, ConsentPreferences } from "../schemas/PatientBio.js";
import { ArtifactRef } from "../schemas/ArtifactRef.js";

export type InputType = "text" | "audio" | "ocr";

export interface BioAgentInput {
  inputType: InputType;
  patient?: Partial<PatientBio>;
  consent?: Partial<ConsentPreferences>;
  artifact?: ArtifactRef;
  rawText?: string;
}

export interface BioAgentOutput {
  patient: PatientBio;
  consentValidated: boolean;
  missingFields: string[];
  inputSource: InputType;
  extractedData?: Partial<PatientBio>;
}

export class BioAgent implements Agent<BioAgentInput, BioAgentOutput> {
  public readonly name = "BioAgent";
  public readonly promptPath = "prompts/bio.md";

  constructor(private readonly deps: AgentDependencies) {}

  async run(input: BioAgentInput, context: AgentRunContext): Promise<AgentResult<BioAgentOutput>> {
    let extractedData: Partial<PatientBio> = {};
    let patientData = input.patient || {};
    let consentData = input.consent || {};

    // Handle multi-modal input processing
    if (input.inputType === "audio" || input.inputType === "ocr") {
      if (input.rawText) {
        extractedData = await this.parseTextToPatientBio(input.rawText, context);
        patientData = { ...patientData, ...extractedData };
      }
    }

    const mergedPatient = this.mergePatient(context, { patient: patientData, consent: consentData });
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

    const provenanceNotes = input.inputType !== "text"
      ? `Data extracted from ${input.inputType} input${input.artifact ? ` (artifact: ${input.artifact.id})` : ""}`
      : undefined;

    return {
      data: {
        patient: mergedPatient,
        consentValidated: consentValid,
        missingFields: missing,
        inputSource: input.inputType,
        extractedData,
      },
      updatedRecord: nextRecord,
      followUps: missing,
      provenance: [
        {
          agent: this.name,
          field: "patient",
          timestamp: new Date().toISOString(),
          artifactId: input.artifact?.id,
          notes: provenanceNotes || (missing.length ? "Awaiting confirmation on missing demographic fields" : undefined),
        },
      ],
    };
  }

  isComplete(context: AgentRunContext): boolean {
    return this.computeMissingFields(context.record.patient).length === 0 && this.hasConsent(context.record.patient);
  }

  private async parseTextToPatientBio(text: string, context: AgentRunContext): Promise<Partial<PatientBio>> {
    const prompt = await this.deps.promptLoader.load("prompts/bio-parser.md");

    // Create a parsing prompt that extracts structured data from natural language
    const systemPrompt = `${prompt}

Extract patient biographical information from the following text and return it as a JSON object with these fields:
- firstName (string, optional)
- lastName (string, optional)
- preferredName (string, optional)
- dateOfBirth (YYYY-MM-DD format, optional)
- age (number, optional)
- sex ("female" | "male" | "intersex" | "unspecified", optional)
- mrn (string, optional)
- consent object with dataStorage, photography, sharingToTeamBoard (booleans)

Text to parse: "${text}"

Return only valid JSON. If a field cannot be determined, omit it. For consent, assume dataStorage and photography are true if patient provides data, and sharingToTeamBoard is false unless explicitly mentioned.`;

    try {
      // Use the LLM dependency to parse the text
      if (this.deps.llm) {
        const response = await this.deps.llm.generate({
          systemPrompt,
          maxOutputTokens: 500,
        });

        // Parse the JSON response
        const parsed = JSON.parse(response.text || "{}");

        // Validate against PatientBio schema
        return this.sanitizeExtractedData(parsed);
      }
    } catch (error) {
      context.logger?.warn?.("Failed to parse text to patient bio", { error, text });
    }

    return {};
  }

  private sanitizeExtractedData(parsed: any): Partial<PatientBio> {
    const sanitized: Partial<PatientBio> = {};

    if (typeof parsed.firstName === "string" && parsed.firstName.trim()) {
      sanitized.firstName = parsed.firstName.trim();
    }
    if (typeof parsed.lastName === "string" && parsed.lastName.trim()) {
      sanitized.lastName = parsed.lastName.trim();
    }
    if (typeof parsed.preferredName === "string" && parsed.preferredName.trim()) {
      sanitized.preferredName = parsed.preferredName.trim();
    }
    if (typeof parsed.dateOfBirth === "string" && /^\d{4}-\d{2}-\d{2}$/.test(parsed.dateOfBirth)) {
      sanitized.dateOfBirth = parsed.dateOfBirth;
    }
    if (typeof parsed.age === "number" && parsed.age >= 0 && parsed.age <= 120) {
      sanitized.age = parsed.age;
    }
    if (["female", "male", "intersex", "unspecified"].includes(parsed.sex)) {
      sanitized.sex = parsed.sex;
    }
    if (typeof parsed.mrn === "string" && parsed.mrn.trim()) {
      sanitized.mrn = parsed.mrn.trim();
    }

    // Handle consent object
    if (parsed.consent && typeof parsed.consent === "object") {
      sanitized.consent = {
        dataStorage: Boolean(parsed.consent.dataStorage),
        photography: Boolean(parsed.consent.photography),
        sharingToTeamBoard: Boolean(parsed.consent.sharingToTeamBoard),
      };
    }

    return sanitized;
  }

  private mergePatient(context: AgentRunContext, input: { patient?: Partial<PatientBio>; consent?: Partial<ConsentPreferences> }): PatientBio {
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