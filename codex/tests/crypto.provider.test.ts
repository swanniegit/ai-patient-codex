import { EnvKeyCryptoProvider } from "../crypto/provider";
import { encryptField } from "../crypto/encryption";

const ACTIVE_KEY = Buffer.alloc(32, 7).toString("base64");
const LEGACY_KEY = Buffer.alloc(32, 9).toString("base64");

describe("EnvKeyCryptoProvider", () => {
  beforeAll(() => {
    process.env.FIELD_ENCRYPTION_KEY = ACTIVE_KEY;
    process.env.FIELD_ENCRYPTION_KEY_VERSION = "1";
  });

  it("encrypts and decrypts round-trip with active key", async () => {
    const provider = new EnvKeyCryptoProvider();
    const payload = await provider.encrypt("secret");
    const plain = await provider.decrypt(payload);
    expect(plain).toBe("secret");
  });

  it("resolves legacy key versions", async () => {
    const provider = new EnvKeyCryptoProvider({ legacyKeys: { 2: LEGACY_KEY } });
    const legacyPayload = encryptField("legacy", {
      key: Buffer.from(LEGACY_KEY, "base64"),
      keyVersion: 2,
    });
    const plain = await provider.decrypt(legacyPayload);
    expect(plain).toBe("legacy");
  });
});
