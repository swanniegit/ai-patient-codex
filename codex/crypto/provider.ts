import { encryptField, decryptField, loadKeyFromEnv, EncryptionConfig } from "./encryption.js";
import { CryptoPayload, CryptoProvider } from "./types.js";

export interface EnvKeyCryptoProviderOptions {
  envVar?: string;
  fallbackVersion?: number;
  legacyKeys?: Record<number, string>; // base64 encoded keys keyed by version
}

export class EnvKeyCryptoProvider implements CryptoProvider {
  private readonly activeConfig: EncryptionConfig;
  private readonly legacyConfigs: Map<number, EncryptionConfig> = new Map();

  constructor(private readonly options: EnvKeyCryptoProviderOptions = {}) {
    const envVar = options.envVar ?? "FIELD_ENCRYPTION_KEY";
    const fallbackVersion = options.fallbackVersion ?? 1;
    this.activeConfig = loadKeyFromEnv(envVar, fallbackVersion);

    if (options.legacyKeys) {
      Object.entries(options.legacyKeys).forEach(([version, b64]) => {
        const key = Buffer.from(b64, "base64");
        if (key.length !== 32) {
          throw new Error(`Legacy key ${version} must be 32 bytes`);
        }
        this.legacyConfigs.set(Number(version), {
          key,
          keyVersion: Number(version),
        });
      });
    }
  }

  async encrypt(value: string): Promise<CryptoPayload> {
    return encryptField(value, this.activeConfig);
  }

  async decrypt(payload: CryptoPayload): Promise<string> {
    const config = this.resolveConfig(payload.keyVersion);
    return decryptField(payload, config);
  }

  private resolveConfig(version: number): EncryptionConfig {
    if (version === this.activeConfig.keyVersion) {
      return this.activeConfig;
    }
    const legacy = this.legacyConfigs.get(version);
    if (!legacy) {
      throw new Error(`No encryption key available for version ${version}`);
    }
    return legacy;
  }
}
