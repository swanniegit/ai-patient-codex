import path from "path";
import { promises as fs } from "fs";
import { AgentDependencies, AgentLogger, PromptLoader } from "../agents/AgentContext";
import { CryptoProvider } from "../crypto/types";
import { EnvKeyCryptoProvider, EnvKeyCryptoProviderOptions } from "../crypto/provider";

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

  return {
    promptLoader,
    logger: options.logger,
    cryptoProvider,
  };
};
