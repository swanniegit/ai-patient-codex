import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { PostgrestError } from "@supabase/postgrest-js";
import { SupabaseCaseRecordRepository } from "./supabaseRepository";
import { CaseRecordRepository, SupabaseClientLike } from "./types";

export interface SupabaseConfig {
  url?: string;
  serviceRoleKey?: string;
  anonKey?: string;
}

export const createSupabaseClient = (config: SupabaseConfig = {}): SupabaseClient => {
  const url = config.url ?? process.env.SUPABASE_URL;
  const serviceRole = config.serviceRoleKey ?? process.env.SUPABASE_SERVICE_ROLE;
  const anon = config.anonKey ?? process.env.SUPABASE_ANON_KEY;

  const key = serviceRole ?? anon;
  if (!url || !key) {
    throw new Error("SUPABASE_URL and a key (service role or anon) are required");
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
    },
  });
};

export const createCaseRecordRepository = (config: SupabaseConfig = {}): CaseRecordRepository => {
  const client = createSupabaseClient(config);
  return new SupabaseCaseRecordRepository(wrapClient(client));
};

const normalizeError = (error: PostgrestError | null): Error | null => {
  if (!error) return null;
  const normalized = new Error(error.message ?? "Supabase request failed");
  normalized.name = error.code ?? "PostgrestError";
  (normalized as Error & { cause?: unknown }).cause = error;
  return normalized;
};

export const wrapClient = (client: SupabaseClient): SupabaseClientLike => ({
  from(table) {
    return {
      async upsert(value, options) {
        const response = await client.from(table).upsert(value, options);
        return {
          data: (response.data ?? null) as unknown,
          error: normalizeError(response.error),
        };
      },
      select(columns) {
        return {
          async eq(column, value) {
            const response = await client.from(table).select(columns ?? "*").eq(column as string, value);
            return {
              data: (response.data ?? null) as Array<Record<string, unknown>> | null,
              error: normalizeError(response.error),
            };
          },
        };
      },
    };
  },
});
