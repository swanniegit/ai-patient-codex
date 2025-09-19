import { Agent } from "./AgentInterface";
import { AgentDependencies, AgentResult, AgentRunContext } from "./AgentContext";
import { ArtifactRef } from "../schemas/ArtifactRef";

export interface OcrAsrInput {
  artifact: ArtifactRef;
}

export interface OcrAsrOutput {
  artifactId: string;
  text: string;
  confidence: number;
  rawResponse?: Record<string, unknown>;
}

export class OcrAsrAgent implements Agent<OcrAsrInput, OcrAsrOutput> {
  public readonly name = "OcrAsrAgent";
  public readonly promptPath = "prompts/global.md"; // serves as base guardrail

  constructor(private readonly deps: AgentDependencies) {}

  async run(input: OcrAsrInput, context: AgentRunContext): Promise<AgentResult<OcrAsrOutput>> {
    const { artifact } = input;
    if (artifact.kind !== "image" && artifact.kind !== "audio" && artifact.kind !== "document") {
      throw new Error(`Unsupported artifact kind: ${artifact.kind}`);
    }

    const prompt = await this.deps.promptLoader.load(this.promptPath ?? "");
    context.logger?.info("Running OCR/ASR prompt", { promptLength: prompt.length });

    const text = this.stubExtraction(artifact);

    return {
      data: {
        artifactId: artifact.id,
        text,
        confidence: artifact.qa?.confidence ?? 0.5,
      },
      provenance: [
        {
          agent: this.name,
          field: `artifact:${artifact.id}:transcription`,
          timestamp: new Date().toISOString(),
          notes: "Transcription generated via placeholder logic.",
        },
      ],
    };
  }

  private stubExtraction(artifact: ArtifactRef): string {
    if (artifact.description) {
      return `Placeholder transcription for ${artifact.description}`;
    }
    return "No transcription available yet.";
  }
}

export const createOcrAsrAgent = (deps: AgentDependencies) => new OcrAsrAgent(deps);
