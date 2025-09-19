import { createClient, SupabaseClient } from "@supabase/supabase-js";
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

export const wrapClient = (client: SupabaseClient): SupabaseClientLike => ({
  from(table) {
    return {
      upsert: (value, options) => client.from(table).upsert(value, options),
      select: (columns) => ({
        eq: (column, value) => client.from(table).select(columns ?? "*").eq(column as string, value),
      }),
    };
  },
});
