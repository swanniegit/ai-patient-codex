import { randomBytes, createCipheriv, createDecipheriv } from "crypto";

export interface EncryptionResult {
  ciphertext: string;
  iv: string;
  authTag: string;
  keyVersion: number;
}

export interface EncryptionConfig {
  key: Buffer;
  keyVersion: number;
}

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // per NIST recommendation for GCM

export const encryptField = (plainText: string, config: EncryptionConfig): EncryptionResult => {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, config.key, iv);
  const ciphertext = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    ciphertext: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    authTag: authTag.toString("base64"),
    keyVersion: config.keyVersion,
  };
};

export const decryptField = (
  payload: Pick<EncryptionResult, "ciphertext" | "iv" | "authTag">,
  config: EncryptionConfig
): string => {
  const decipher = createDecipheriv(
    ALGORITHM,
    config.key,
    Buffer.from(payload.iv, "base64")
  );
  decipher.setAuthTag(Buffer.from(payload.authTag, "base64"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(payload.ciphertext, "base64")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
};

export const loadKeyFromEnv = (envVar: string, fallbackVersion = 1): EncryptionConfig => {
  const keyB64 = process.env[envVar];
  if (!keyB64) {
    throw new Error(`Missing encryption key env var: ${envVar}`);
  }
  const key = Buffer.from(keyB64, "base64");
  if (key.length !== 32) {
    throw new Error("Encryption key must be 32 bytes for aes-256-gcm");
  }
  const version = Number(process.env[`${envVar}_VERSION`] ?? fallbackVersion);
  return { key, keyVersion: version };
};
