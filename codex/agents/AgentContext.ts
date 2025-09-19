import { CaseRecord, ProvenanceEntry } from "../schemas/CaseRecord";
import { ArtifactRef } from "../schemas/ArtifactRef";
import { CryptoProvider } from "../crypto/types";

export interface PromptLoader {
  load(path: string): Promise<string>;
}

export interface AgentLogger {
  info(message: string, context?: Record<string, unknown>): void;
  warn?(message: string, context?: Record<string, unknown>): void;
  error?(message: string, context?: Record<string, unknown>): void;
}

export interface AgentRunContext {
  record: CaseRecord;
  artifacts: ArtifactRef[];
  autosave?: (draft: CaseRecord) => Promise<void>;
  logger?: AgentLogger;
  abortSignal?: AbortSignal;
  cryptoProvider?: CryptoProvider;
}

export interface AgentResult<TOutput> {
  data: TOutput;
  updatedRecord?: CaseRecord;
  followUps?: string[];
  provenance?: ProvenanceEntry[];
}

export interface LlmMessage {
  role: "user" | "model" | "system";
  content: string;
}

export interface LlmGenerateOptions {
  input?: string;
  messages?: LlmMessage[];
  systemPrompt?: string;
  temperature?: number;
  topP?: number;
  topK?: number;
  maxOutputTokens?: number;
  stopSequences?: string[];
  signal?: AbortSignal;
}

export interface LlmGenerateResult {
  text: string;
  raw?: unknown;
}

export interface LlmClient {
  generate(options: LlmGenerateOptions): Promise<LlmGenerateResult>;
}

export interface AgentDependencies {
  promptLoader: PromptLoader;
  logger?: AgentLogger;
  cryptoProvider?: CryptoProvider;
  llm?: LlmClient;
}
