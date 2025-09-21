import { CaseRecord } from "../../schemas/CaseRecord.js";
import { CaseRecordRepository, SupabaseClientLike } from "./types.js";

interface CaseRecordRow extends Record<string, unknown> {
  case_id: string;
  clinician_id: string;
  clinician_pin_hash: string;
  storage_meta: Record<string, unknown>;
  payload: Record<string, unknown>;
  encrypted_fields?: Record<string, unknown>;
  consent_granted: boolean;
  status: string;
  created_at: string;
  updated_at: string;
}

const TABLE = "case_records";

const buildPayload = (record: CaseRecord) => ({
  patient: record.patient,
  wounds: record.wounds,
  vitals: record.vitals,
  time: record.time,
  followUps: record.followUps,
  artifacts: record.artifacts,
  provenanceLog: record.provenanceLog,
});

const serialize = (record: CaseRecord): CaseRecordRow => ({
  case_id: record.caseId,
  clinician_id: record.clinicianId,
  clinician_pin_hash: record.clinicianPinHash,
  storage_meta: {
    version: record.storageMeta.version,
    schema: record.storageMeta.schema,
    state: record.storageMeta.state,
  },
  payload: buildPayload(record),
  encrypted_fields: record.encryptedFields,
  consent_granted: record.consentGranted,
  status: record.status,
  created_at: record.createdAt,
  updated_at: record.updatedAt,
});

const normalizeTimestamp = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid timestamp: ${value}`);
  }
  return date.toISOString();
};

const deserialize = (row: CaseRecordRow): CaseRecord => {
  const base = {
    caseId: row.case_id,
    clinicianId: row.clinician_id,
    clinicianPinHash: row.clinician_pin_hash,
    storageMeta: row.storage_meta,
    createdAt: normalizeTimestamp(row.created_at),
    updatedAt: normalizeTimestamp(row.updated_at),
    consentGranted: row.consent_granted,
    status: row.status as CaseRecord["status"],
    encryptedFields: row.encrypted_fields ?? {},
    ...(row.payload ?? {}),
  } as Record<string, unknown>;

  return CaseRecord.parse(base);
};

export class SupabaseCaseRecordRepository implements CaseRecordRepository {
  constructor(private readonly client: SupabaseClientLike) {}

  async save(record: CaseRecord): Promise<void> {
    const payload = serialize(record);
    const { error } = await this.client.from(TABLE).upsert(payload, { onConflict: "case_id" });
    if (error) {
      throw error;
    }
  }

  async fetchById(caseId: string): Promise<CaseRecord | null> {
    const { data, error } = await this.client.from(TABLE).select("*").eq("case_id", caseId);
    if (error) {
      throw error;
    }
    if (!data || data.length === 0) return null;
    return deserialize(data[0] as unknown as CaseRecordRow);
  }
}
