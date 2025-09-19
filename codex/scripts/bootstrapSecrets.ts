/**
 * Bootstrap script to provision secrets across environments.
 * Intended to run via `ts-node` inside secure CI context.
 */
import { spawnSync } from "child_process";

type EnvTarget = "development" | "preview" | "production";

type SecretPayload = Record<string, string>;

const secretsByEnv: Record<EnvTarget, SecretPayload> = {
  development: {
    SUPABASE_URL: process.env.SUPABASE_URL_DEV ?? "",
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY_DEV ?? "",
    SUPABASE_SERVICE_ROLE: process.env.SUPABASE_SERVICE_ROLE_DEV ?? "",
    PIN_HASH_PEPPER: process.env.PIN_HASH_PEPPER_DEV ?? "",
    FIELD_ENCRYPTION_KEY: process.env.FIELD_ENCRYPTION_KEY_DEV ?? "",
  },
  preview: {
    SUPABASE_URL: process.env.SUPABASE_URL_PREVIEW ?? "",
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY_PREVIEW ?? "",
    SUPABASE_SERVICE_ROLE: process.env.SUPABASE_SERVICE_ROLE_PREVIEW ?? "",
    PIN_HASH_PEPPER: process.env.PIN_HASH_PEPPER_PREVIEW ?? "",
    FIELD_ENCRYPTION_KEY: process.env.FIELD_ENCRYPTION_KEY_PREVIEW ?? "",
  },
  production: {
    SUPABASE_URL: process.env.SUPABASE_URL_PROD ?? "",
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY_PROD ?? "",
    SUPABASE_SERVICE_ROLE: process.env.SUPABASE_SERVICE_ROLE_PROD ?? "",
    PIN_HASH_PEPPER: process.env.PIN_HASH_PEPPER_PROD ?? "",
    FIELD_ENCRYPTION_KEY: process.env.FIELD_ENCRYPTION_KEY_PROD ?? "",
  },
};

const ensureValue = (value: string, key: string, env: EnvTarget) => {
  if (!value) {
    throw new Error(`Missing value for ${key} in ${env}`);
  }
};

const pushSecret = (key: string, value: string, env: EnvTarget) => {
  const child = spawnSync("vercel", ["env", "add", key, env], {
    stdio: ["pipe", "inherit", "inherit"],
    env: process.env,
  });
  if (child.error || child.status !== 0) {
    throw child.error ?? new Error(`Failed to set ${key} for ${env}`);
  }
};

(async () => {
  const target = (process.argv[2] as EnvTarget) ?? "development";
  const payload = secretsByEnv[target];
  Object.entries(payload).forEach(([key, value]) => ensureValue(value, key, target));
  Object.entries(payload).forEach(([key, value]) => {
    pushSecret(key, value, target);
    console.log(`✔ ${target} :: ${key}`);
  });
})();
