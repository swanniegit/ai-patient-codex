export interface CryptoPayload {
  ciphertext: string;
  iv: string;
  authTag: string;
  keyVersion: number;
}

export interface CryptoProvider {
  encrypt(value: string): Promise<CryptoPayload>;
  decrypt(payload: CryptoPayload): Promise<string>;
}
