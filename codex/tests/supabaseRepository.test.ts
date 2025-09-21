import { SupabaseCaseRecordRepository } from "../app/storage/supabaseRepository.js";
import { createStubCaseRecord } from "./testUtils.js";
import { SupabaseClientLike } from "../app/storage/types.js";

type UpsertCall = Record<string, unknown> & { payload?: Record<string, unknown> };

const buildClient = (): {
  calls: {
    upsert: Array<UpsertCall>;
    select: Array<number>;
  };
  client: SupabaseClientLike;
} => {
  const calls = {
    upsert: [] as Array<UpsertCall>,
    select: [] as Array<number>,
  };

  const client: SupabaseClientLike = {
    from: () => ({
      upsert: async (value: Record<string, unknown>) => {
        calls.upsert.push(value);
        return { data: null, error: null };
      },
      select: () => ({
        eq: async () => {
          calls.select.push(1);
          return {
            data: [
              {
                case_id: "123e4567-e89b-12d3-a456-426614174000",
                clinician_id: "123e4567-e89b-12d3-a456-426614174001",
                clinician_pin_hash: "hash",
                storage_meta: { version: 1, schema: "codex.wound.v1" },
                payload: {
                  patient: {
                    patientId: "123e4567-e89b-12d3-a456-426614174099",
                    consent: {
                      dataStorage: true,
                      photography: true,
                      sharingToTeamBoard: false,
                    },
                    notes: [],
                  },
                  wounds: {
                    site: "left heel",
                    description: "Baseline",
                    photos: [],
                  },
                  followUps: [],
                  artifacts: [],
                  provenanceLog: [],
                },
                encrypted_fields: {},
                consent_granted: false,
                status: "draft",
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              },
            ],
            error: null,
          };
        },
      }),
    }),
  };

  return { calls, client };
};

describe("SupabaseCaseRecordRepository", () => {
  it("serializes record on save", async () => {
    const { calls, client } = buildClient();
    const repo = new SupabaseCaseRecordRepository(client);
    const record = createStubCaseRecord();
    await repo.save(record);
    expect(calls.upsert.length).toBe(1);
    expect(calls.upsert[0].case_id).toBe(record.caseId);
    const savedPayload = calls.upsert[0].payload as { patient?: unknown } | undefined;
    expect(savedPayload?.patient).toBeDefined();
  });

  it("deserializes record on fetch", async () => {
    const { client } = buildClient();
    const repo = new SupabaseCaseRecordRepository(client);
    const record = await repo.fetchById("123e4567-e89b-12d3-a456-426614174000");
    expect(record?.caseId).toBe("123e4567-e89b-12d3-a456-426614174000");
  });
});
