import path from "path";
import { createAgentDependencies } from "../app/dependencies.js";
import { EnvKeyCryptoProvider } from "../crypto/provider.js";

const KEY = Buffer.alloc(32, 5).toString("base64");

describe("createAgentDependencies", () => {
  it("returns crypto provider when env present", () => {
    process.env.FIELD_ENCRYPTION_KEY = KEY;
    process.env.FIELD_ENCRYPTION_KEY_VERSION = "3";
    const deps = createAgentDependencies();
    expect(deps.cryptoProvider).toBeInstanceOf(EnvKeyCryptoProvider);
  });

  it("allows overriding prompt directory", async () => {
    process.env.FIELD_ENCRYPTION_KEY = KEY;
    const deps = createAgentDependencies({ promptDir: path.resolve(__dirname, "../prompts") });
    const prompt = await deps.promptLoader.load("global.md");
    expect(typeof prompt).toBe("string");
  });
});
