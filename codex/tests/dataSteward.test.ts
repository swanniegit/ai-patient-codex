import { DataStewardAgent } from "../agents/DataStewardAgent";
import { AgentDependencies, AgentRunContext } from "../agents/AgentContext";
import { CryptoProvider } from "../crypto/types";
import { createStubCaseRecord } from "./testUtils";

const fakeCrypto: CryptoProvider = {
  encrypt: async (value: string) => ({
    ciphertext: Buffer.from(value).toString("base64"),
    iv: "iv",
    authTag: "tag",
    keyVersion: 1,
  }),
  decrypt: async ({ ciphertext }) => Buffer.from(ciphertext, "base64").toString("utf8"),
};

const deps: AgentDependencies = {
  promptLoader: {
    load: async () => "",
  },
  cryptoProvider: fakeCrypto,
};

describe("DataStewardAgent", () => {
  it("moves sensitive fields into encrypted map", async () => {
    const agent = new DataStewardAgent(deps);
    const record = createStubCaseRecord();
    const context: AgentRunContext = {
      record,
      artifacts: [],
      cryptoProvider: fakeCrypto,
    };

    const result = await agent.run({}, context);
    const encrypted = result.updatedRecord?.encryptedFields ?? {};

    expect(encrypted["patient.firstName"]).toBeDefined();
    expect(result.updatedRecord?.patient.firstName).toBeUndefined();
  });
});
