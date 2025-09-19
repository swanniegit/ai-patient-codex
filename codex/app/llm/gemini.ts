import { AgentLogger, LlmClient, LlmGenerateOptions, LlmGenerateResult } from "../../agents/AgentContext";

export interface GeminiClientOptions {
  apiKey?: string;
  model?: string;
  apiBaseUrl?: string;
  safetySetting?: "BLOCK_NONE" | "BLOCK_ONLY_HIGH" | "BLOCK_MEDIUM_AND_ABOVE" | "BLOCK_LOW_AND_ABOVE";
  temperature?: number;
  maxOutputTokens?: number;
  topP?: number;
  topK?: number;
  logger?: AgentLogger;
  fetchImpl?: typeof fetch;
}

const DEFAULT_MODEL = "models/gemini-1.5-flash-latest";
const DEFAULT_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";

export class GeminiClient implements LlmClient {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly apiBaseUrl: string;
  private readonly safetySetting?: GeminiClientOptions["safetySetting"];
  private readonly defaultTemperature?: number;
  private readonly defaultMaxOutputTokens?: number;
  private readonly defaultTopP?: number;
  private readonly defaultTopK?: number;
  private readonly logger?: AgentLogger;
  private readonly fetchImpl: typeof fetch;

  constructor(options: GeminiClientOptions = {}) {
    const apiKey = options.apiKey ?? process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("Gemini API key is required. Set GEMINI_API_KEY or provide apiKey option.");
    }

    this.apiKey = apiKey;
    this.model = options.model ?? process.env.GEMINI_MODEL ?? DEFAULT_MODEL;
    this.apiBaseUrl = options.apiBaseUrl ?? DEFAULT_BASE_URL;
    this.safetySetting = options.safetySetting;
    this.defaultTemperature = options.temperature;
    this.defaultMaxOutputTokens = options.maxOutputTokens;
    this.defaultTopP = options.topP;
    this.defaultTopK = options.topK;
    this.logger = options.logger;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async generate(options: LlmGenerateOptions): Promise<LlmGenerateResult> {
    const systemInstruction = options.systemPrompt?.trim();
    const messages = [...(options.messages ?? [])];

    if (options.input?.trim()) {
      messages.push({ role: "user", content: options.input.trim() });
    }

    if (messages.length === 0) {
      throw new Error("GeminiClient.generate requires at least one message or input text");
    }

    const contents = messages.map((message) => ({
      role: message.role,
      parts: [{ text: message.content }],
    }));

    const body: Record<string, unknown> = {
      contents,
      generationConfig: {
        temperature: options.temperature ?? this.defaultTemperature ?? 0.2,
        maxOutputTokens: options.maxOutputTokens ?? this.defaultMaxOutputTokens ?? 1024,
        topP: options.topP ?? this.defaultTopP ?? 0.8,
        topK: options.topK ?? this.defaultTopK ?? 40,
        stopSequences: options.stopSequences,
      },
    };

    if (systemInstruction) {
      body.systemInstruction = {
        role: "system",
        parts: [{ text: systemInstruction }],
      };
    }

    if (this.safetySetting) {
      body.safetySettings = [
        {
          category: "HARM_CATEGORY_DEROGATORY",
          threshold: this.safetySetting,
        },
        {
          category: "HARM_CATEGORY_MEDICAL",
          threshold: this.safetySetting,
        },
        {
          category: "HARM_CATEGORY_MEDICAL_ADVICE",
          threshold: this.safetySetting,
        },
      ];
    }

    const url = `${this.apiBaseUrl}/${this.model}:generateContent?key=${this.apiKey}`;

    const response = await this.fetchImpl(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: options.signal,
    });

    if (!response.ok) {
      const errorPayload = await safeJson(response);
      const error = new Error(`Gemini request failed with status ${response.status}`);
      (error as Error & { cause?: unknown }).cause = errorPayload;
      this.logger?.error?.("Gemini request failed", { status: response.status, error: errorPayload });
      throw error;
    }

    const json = await response.json();
    const text = extractPrimaryText(json);

    this.logger?.info("Gemini response received", {
      hasText: Boolean(text),
      candidateCount: Array.isArray(json?.candidates) ? json.candidates.length : undefined,
    });

    return {
      text,
      raw: json,
    };
  }
}

const safeJson = async (response: Response) => {
  try {
    return await response.clone().json();
  } catch (error) {
    return { message: response.statusText, error };
  }
};

const extractPrimaryText = (payload: unknown): string => {
  if (!payload || typeof payload !== "object") return "";
  const candidates = (payload as Record<string, unknown>).candidates;
  if (!Array.isArray(candidates) || candidates.length === 0) return "";
  const [primary] = candidates;
  if (!primary || typeof primary !== "object") return "";
  const content = (primary as Record<string, unknown>).content as Record<string, unknown> | undefined;
  if (!content) return "";
  const parts = content.parts;
  if (!Array.isArray(parts)) return "";
  return parts
    .map((part) => {
      if (!part || typeof part !== "object") return "";
      const text = (part as Record<string, unknown>).text;
      return typeof text === "string" ? text : "";
    })
    .join("")
    .trim();
};

export const createGeminiClient = (options: GeminiClientOptions = {}) => new GeminiClient(options);
