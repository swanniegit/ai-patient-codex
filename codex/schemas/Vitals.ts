import { z } from "zod";

const Timestamp = z.string().datetime({ message: "timestamp must be ISO-8601" });

export const BloodPressure = z
  .object({
    systolic: z.number().min(0),
    diastolic: z.number().min(0),
    unit: z.enum(["mmHg"]).default("mmHg"),
    capturedAt: Timestamp,
  })
  .strict();

export const HeartRate = z
  .object({
    bpm: z.number().min(0),
    capturedAt: Timestamp,
    method: z.enum(["manual", "device", "unknown"]).default("unknown"),
  })
  .strict();

export const Temperature = z
  .object({
    value: z.number(),
    unit: z.enum(["C", "F"]).default("C"),
    capturedAt: Timestamp,
    site: z.enum(["oral", "tympanic", "axillary", "temporal", "rectal", "unknown"]).default("unknown"),
  })
  .strict();

export const Vitals = z
  .object({
    bloodPressure: BloodPressure.optional(),
    heartRate: HeartRate.optional(),
    respiratoryRate: z
      .object({
        breathsPerMinute: z.number().min(0),
        capturedAt: Timestamp,
      })
      .optional(),
    temperature: Temperature.optional(),
    oxygenSaturation: z
      .object({
        percent: z.number().min(0).max(100),
        capturedAt: Timestamp,
        method: z.enum(["pulse_ox", "arterial", "unknown"]).default("unknown"),
      })
      .optional(),
    painScore: z
      .object({
        value: z.number().min(0).max(10),
        scale: z.enum(["nrs", "vrs", "flacc", "unknown"]).default("nrs"),
        capturedAt: Timestamp,
      })
      .optional(),
  })
  .strict();

export type Vitals = z.infer<typeof Vitals>;
export type BloodPressure = z.infer<typeof BloodPressure>;
export type HeartRate = z.infer<typeof HeartRate>;
export type Temperature = z.infer<typeof Temperature>;
