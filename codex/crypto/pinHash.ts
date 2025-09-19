import { randomBytes, timingSafeEqual } from "crypto";
import argon2 from "argon2";

const PEPPER_ENV = "PIN_HASH_PEPPER";

export interface PinHashResult {
  hash: string;
  salt: string;
}

export const hashPin = async (pin: string): Promise<PinHashResult> => {
  const salt = randomBytes(16).toString("base64");
  const pepper = getPepper();
  const hash = await argon2.hash(`${pin}${pepper}`, {
    type: argon2.argon2id,
    salt: Buffer.from(salt, "base64"),
    memoryCost: 2 ** 16,
    timeCost: 4,
    parallelism: 1,
  });
  return { hash, salt };
};

export const verifyPin = async (pin: string, storedHash: string): Promise<boolean> => {
  const pepper = getPepper();
  try {
    return await argon2.verify(storedHash, `${pin}${pepper}`);
  } catch {
    return false;
  }
};

export const constantTimeCompare = (a: string, b: string): boolean => {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
};

const getPepper = (): string => {
  const pepper = process.env[PEPPER_ENV];
  if (!pepper) {
    throw new Error(`Missing required env var ${PEPPER_ENV}`);
  }
  return pepper;
};
