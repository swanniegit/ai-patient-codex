import path from "path";
import { promises as fs } from "fs";
import { AgentDependencies, AgentLogger, LlmClient, PromptLoader } from "../agents/AgentContext";
import { CryptoProvider } from "../crypto/types";
import { EnvKeyCryptoProvider, EnvKeyCryptoProviderOptions } from "../crypto/provider";
import { createGeminiClient, GeminiClientOptions } from "./llm";

class FilePromptLoader implements PromptLoader {
  constructor(private readonly baseDir: string) {}

  async load(relativePath: string): Promise<string> {
    const fullPath = path.isAbsolute(relativePath)
      ? relativePath
      : path.join(this.baseDir, relativePath);
    return fs.readFile(fullPath, "utf8");
  }
}

export interface DependencyOptions {
  promptDir?: string;
  logger?: AgentLogger;
  cryptoProvider?: CryptoProvider;
  cryptoOptions?: EnvKeyCryptoProviderOptions;
  llmClient?: LlmClient;
  llmOptions?: GeminiClientOptions;
}

export const createAgentDependencies = (options: DependencyOptions = {}): AgentDependencies => {
  const promptDir = options.promptDir ?? path.resolve(process.cwd(), "codex", "prompts");
  const promptLoader = new FilePromptLoader(promptDir);

  let cryptoProvider = options.cryptoProvider;
  if (!cryptoProvider) {
    try {
      cryptoProvider = new EnvKeyCryptoProvider(options.cryptoOptions);
    } catch (error) {
      options.logger?.warn?.("Crypto provider unavailable", { error });
      cryptoProvider = undefined;
    }
  }

  let llm = options.llmClient;
  const shouldInitLlm =
    !llm && Boolean(options.llmOptions?.apiKey ?? process.env.GEMINI_API_KEY);
  if (shouldInitLlm) {
    try {
      llm = createGeminiClient({
        ...options.llmOptions,
        logger: options.logger,
      });
    } catch (error) {
      options.logger?.warn?.("LLM client unavailable", { error });
      llm = undefined;
    }
  }

  return {
    promptLoader,
    logger: options.logger,
    cryptoProvider,
    llm,
  };
};
