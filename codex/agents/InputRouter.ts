import { Agent } from "./AgentInterface.js";
import { AgentDependencies, AgentResult, AgentRunContext } from "./AgentContext.js";
import { ArtifactRef } from "../schemas/ArtifactRef.js";
import { BioAgent, BioAgentInput, BioAgentOutput } from "./BioAgent.js";
import { OcrAsrAgent, OcrAsrInput, OcrAsrOutput, OcrAsrConfig } from "./OcrAsrAgent.js";
import { PatientBio, ConsentPreferences } from "../schemas/PatientBio.js";

export type InputType = "text" | "audio" | "ocr";

export interface InputRouterInput {
  inputType: InputType;
  directInput?: {
    patient?: Partial<PatientBio>;
    consent?: Partial<ConsentPreferences>;
  };
  artifact?: ArtifactRef;
}

export interface InputRouterOutput {
  bioResult: BioAgentOutput;
  ocrAsrResult?: OcrAsrOutput;
  processingFlow: string[];
}

export interface InputRouterConfig {
  ocrAsrConfig?: OcrAsrConfig;
}

export class InputRouter implements Agent<InputRouterInput, InputRouterOutput> {
  public readonly name = "InputRouter";
  public readonly promptPath = "prompts/global.md";

  private bioAgent: BioAgent;
  private ocrAsrAgent: OcrAsrAgent;

  constructor(
    private readonly deps: AgentDependencies,
    config: InputRouterConfig = {}
  ) {
    this.bioAgent = new BioAgent(deps);
    this.ocrAsrAgent = new OcrAsrAgent(deps, config.ocrAsrConfig);
  }

  async run(input: InputRouterInput, context: AgentRunContext): Promise<AgentResult<InputRouterOutput>> {
    const processingFlow: string[] = [`Started ${input.inputType} input processing`];
    let ocrAsrResult: OcrAsrOutput | undefined;
    let extractedText: string | undefined;

    try {
      // Step 1: Process artifact if provided (OCR/ASR)
      if (input.artifact && (input.inputType === "ocr" || input.inputType === "audio")) {
        processingFlow.push(`Processing ${input.artifact.kind} artifact`);

        const ocrAsrInput: OcrAsrInput = {
          artifact: input.artifact,
        };

        const ocrAsrAgentResult = await this.ocrAsrAgent.run(ocrAsrInput, context);
        ocrAsrResult = ocrAsrAgentResult.data;
        extractedText = ocrAsrResult.text;

        processingFlow.push(`Extracted text using ${ocrAsrResult.processingMethod} (confidence: ${ocrAsrResult.confidence.toFixed(2)})`);

        // Update context with OCR/ASR artifacts if needed
        if (ocrAsrAgentResult.updatedRecord) {
          context = {
            ...context,
            record: ocrAsrAgentResult.updatedRecord,
          };
        }
      }

      // Step 2: Process with BioAgent
      processingFlow.push("Processing with BioAgent");

      const bioInput: BioAgentInput = {
        patient: input.directInput?.patient,
        consent: input.directInput?.consent,
        textToParse: extractedText,
        sourceInfo: {
          inputMethod: input.inputType,
          artifactId: input.artifact?.id,
        },
      };

      const bioAgentResult = await this.bioAgent.run(bioInput, context);
      processingFlow.push(`BioAgent completed - extracted ${Object.keys(bioAgentResult.data.extractedData || {}).length} fields`);

      // Combine provenance entries from both agents
      const ocrAsrProvenance = ocrAsrResult ? [{
        agent: this.ocrAsrAgent.name,
        field: `artifact:${ocrAsrResult.artifactId}:transcription`,
        timestamp: new Date().toISOString(),
        notes: `${ocrAsrResult.processingMethod.toUpperCase()} processing completed with confidence ${ocrAsrResult.confidence.toFixed(2)}`,
      }] : [];
      const combinedProvenance = [
        ...ocrAsrProvenance,
        ...(bioAgentResult.provenance || []),
      ];

      return {
        data: {
          bioResult: bioAgentResult.data,
          ocrAsrResult,
          processingFlow,
        },
        updatedRecord: bioAgentResult.updatedRecord,
        followUps: bioAgentResult.followUps,
        provenance: combinedProvenance,
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      processingFlow.push(`Error: ${errorMessage}`);

      context.logger?.error?.("InputRouter processing failed", {
        error: errorMessage,
        inputType: input.inputType,
        artifactId: input.artifact?.id,
      });

      // Return a fallback result
      const fallbackBioInput: BioAgentInput = {
        patient: input.directInput?.patient || {},
        consent: input.directInput?.consent || {},
        sourceInfo: {
          inputMethod: "text",
          artifactId: undefined,
        },
      };

      const fallbackResult = await this.bioAgent.run(fallbackBioInput, context);

      return {
        data: {
          bioResult: fallbackResult.data,
          ocrAsrResult,
          processingFlow,
        },
        updatedRecord: fallbackResult.updatedRecord,
        followUps: [...(fallbackResult.followUps || []), "Processing error occurred - please verify extracted data"],
        provenance: [
          ...(fallbackResult.provenance || []),
          {
            agent: this.name,
            field: "processing_error",
            timestamp: new Date().toISOString(),
            notes: `InputRouter fallback due to error: ${errorMessage}`,
          },
        ],
      };
    }
  }

  isComplete(context: AgentRunContext): boolean {
    return this.bioAgent.isComplete(context);
  }

  /**
   * Factory methods to create input for different scenarios
   */
  static createTextInput(patient?: Partial<PatientBio>, consent?: Partial<ConsentPreferences>): InputRouterInput {
    return {
      inputType: "text",
      directInput: { patient, consent },
    };
  }

  static createAudioInput(artifact: ArtifactRef): InputRouterInput {
    if (artifact.kind !== "audio") {
      throw new Error("Audio input requires an audio artifact");
    }
    return {
      inputType: "audio",
      artifact,
    };
  }

  static createOCRInput(artifact: ArtifactRef): InputRouterInput {
    if (artifact.kind !== "image" && artifact.kind !== "document") {
      throw new Error("OCR input requires an image or document artifact");
    }
    return {
      inputType: "ocr",
      artifact,
    };
  }
}

export const createInputRouter = (deps: AgentDependencies, config?: InputRouterConfig) => new InputRouter(deps, config);