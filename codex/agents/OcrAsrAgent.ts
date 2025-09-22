import { Agent } from "./AgentInterface.js";
import { AgentDependencies, AgentResult, AgentRunContext } from "./AgentContext.js";
import { ArtifactRef } from "../schemas/ArtifactRef.js";
import { createWorker } from "tesseract.js";
import OpenAI from "openai";

export interface OcrAsrInput {
  artifact: ArtifactRef;
}

export interface OcrAsrOutput {
  artifactId: string;
  text: string;
  confidence: number;
  rawResponse?: Record<string, unknown>;
  processingMethod: "ocr" | "asr";
}

export interface OcrAsrConfig {
  openaiApiKey?: string;
  tesseractOptions?: {
    logger?: (m: any) => void;
    langPath?: string;
  };
}

export class OcrAsrAgent implements Agent<OcrAsrInput, OcrAsrOutput> {
  public readonly name = "OcrAsrAgent";
  public readonly promptPath = "prompts/global.md";

  private openai?: OpenAI;

  constructor(
    private readonly deps: AgentDependencies,
    private readonly config: OcrAsrConfig = {}
  ) {
    // Get OpenAI API key from config or environment
    const apiKey = config.openaiApiKey || process.env.OPENAI_API_KEY;
    if (apiKey) {
      this.openai = new OpenAI({
        apiKey: apiKey,
      });
    }
  }

  async run(input: OcrAsrInput, context: AgentRunContext): Promise<AgentResult<OcrAsrOutput>> {
    const { artifact } = input;

    if (artifact.kind !== "image" && artifact.kind !== "audio" && artifact.kind !== "document") {
      throw new Error(`Unsupported artifact kind: ${artifact.kind}`);
    }

    context.logger?.info?.("Processing artifact", {
      artifactId: artifact.id,
      kind: artifact.kind,
      storageType: artifact.metadata?.storageType || "unknown",
    });

    try {
      if (artifact.kind === "image" || artifact.kind === "document") {
        const result = await this.processWithOCR(artifact, context);
        return {
          data: {
            artifactId: artifact.id,
            text: result.text,
            confidence: result.confidence,
            processingMethod: "ocr",
            rawResponse: result.rawResponse,
          },
          provenance: [
            {
              agent: this.name,
              field: `artifact:${artifact.id}:transcription`,
              timestamp: new Date().toISOString(),
              notes: `OCR processing completed with confidence ${result.confidence.toFixed(2)}`,
            },
          ],
        };
      } else if (artifact.kind === "audio") {
        const result = await this.processWithASR(artifact, context);
        return {
          data: {
            artifactId: artifact.id,
            text: result.text,
            confidence: result.confidence,
            processingMethod: "asr",
            rawResponse: result.rawResponse,
          },
          provenance: [
            {
              agent: this.name,
              field: `artifact:${artifact.id}:transcription`,
              timestamp: new Date().toISOString(),
              notes: `ASR processing completed with confidence ${result.confidence.toFixed(2)}`,
            },
          ],
        };
      }

      throw new Error(`Unhandled artifact kind: ${artifact.kind}`);
    } catch (error) {
      context.logger?.error?.("Failed to process artifact", {
        error: error instanceof Error ? error.message : String(error),
        artifactId: artifact.id,
      });
      throw error;
    }
  }

  private async processWithOCR(artifact: ArtifactRef, context: AgentRunContext): Promise<{
    text: string;
    confidence: number;
    rawResponse: Record<string, unknown>;
  }> {
    context.logger?.info?.("Starting OCR processing");

    const worker = await createWorker("eng", 1, this.config.tesseractOptions);

    try {
      // Get image data from artifact
      const imageData = await this.getArtifactData(artifact);

      // Process with Tesseract
      const { data } = await worker.recognize(imageData);

      await worker.terminate();

      const text = data.text.trim();
      const confidence = data.confidence / 100; // Convert to 0-1 scale

      context.logger?.info?.("OCR processing completed", {
        textLength: text.length,
        confidence,
      });

      return {
        text,
        confidence,
        rawResponse: {
          tesseractData: {
            confidence: data.confidence,
            lines: data.lines?.length || 0,
            words: data.words?.length || 0,
            symbols: data.symbols?.length || 0,
          },
        },
      };
    } catch (error) {
      await worker.terminate();
      throw new Error(`OCR processing failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async processWithASR(artifact: ArtifactRef, context: AgentRunContext): Promise<{
    text: string;
    confidence: number;
    rawResponse: Record<string, unknown>;
  }> {
    if (!this.openai) {
      throw new Error("OpenAI API key not configured for ASR processing. Set OPENAI_API_KEY environment variable.");
    }

    context.logger?.info?.("Starting ASR processing with OpenAI Whisper");

    try {
      // Get audio data from artifact
      const audioBuffer = await this.getArtifactData(artifact);

      // Create a File object from the buffer
      const audioFile = new File([new Uint8Array(audioBuffer)], "audio.mp3", {
        type: artifact.metadata?.mimeType || "audio/mpeg"
      });

      // Process with OpenAI Whisper
      const transcription = await this.openai.audio.transcriptions.create({
        file: audioFile,
        model: "whisper-1",
        response_format: "verbose_json",
      });

      const text = transcription.text.trim();
      // Whisper doesn't provide confidence scores, so we use duration as a proxy
      const confidence = transcription.duration ? Math.min(0.95, Math.max(0.7, transcription.duration / 10)) : 0.85;

      context.logger?.info?.("ASR processing completed", {
        textLength: text.length,
        duration: transcription.duration,
        language: transcription.language,
      });

      return {
        text,
        confidence,
        rawResponse: {
          whisperData: {
            language: transcription.language,
            duration: transcription.duration,
            segments: transcription.segments?.length || 0,
          },
        },
      };
    } catch (error) {
      throw new Error(`ASR processing failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async getArtifactData(artifact: ArtifactRef): Promise<Buffer> {
    try {
      if (artifact.uri.startsWith("data:")) {
        // Handle data URLs (Vercel serverless)
        const base64Data = artifact.uri.split(",")[1];
        if (!base64Data) {
          throw new Error("Invalid data URL format");
        }
        return Buffer.from(base64Data, "base64");
      } else if (artifact.uri.startsWith("http://") || artifact.uri.startsWith("https://")) {
        // Download from URL
        const response = await fetch(artifact.uri);
        if (!response.ok) {
          throw new Error(`Failed to download artifact: ${response.status} ${response.statusText}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        return Buffer.from(arrayBuffer);
      } else if (artifact.uri.startsWith("file://")) {
        // This won't work on Vercel but keeping for local development
        throw new Error("File:// URLs not supported in serverless environment. Use data URLs or HTTP URLs.");
      } else {
        throw new Error(`Unsupported URI scheme: ${artifact.uri}`);
      }
    } catch (error) {
      throw new Error(`Failed to read artifact data: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

export const createOcrAsrAgent = (deps: AgentDependencies, config?: OcrAsrConfig) => new OcrAsrAgent(deps, config);