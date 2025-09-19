import { z } from "zod";

export const ConsentPreferences = z.object({
  dataStorage: z.boolean(),
  photography: z.boolean(),
  sharingToTeamBoard: z.boolean(),
  notes: z.string().optional(),
  capturedAt: z.string().datetime().optional(),
  capturedBy: z.string().optional(),
});

export const PatientContact = z
  .object({
    phone: z.string().optional(),
    email: z.string().email().optional(),
    addressLine1: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    postalCode: z.string().optional(),
  })
  .partial();

export const PatientBio = z.object({
  patientId: z.string().uuid().optional(),
  firstName: z.string().min(1).optional(),
  lastName: z.string().optional(),
  preferredName: z.string().optional(),
  dateOfBirth: z
    .string()
    .regex(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/)
    .optional(),
  age: z.number().int().min(0).max(120).optional(),
  sex: z.enum(["female", "male", "intersex", "unspecified"]).optional(),
  mrn: z.string().optional(),
  consent: ConsentPreferences,
  contact: PatientContact.optional(),
  notes: z.array(z.string()).default([]),
  provenance: z
    .object({
      agent: z.string(),
      timestamp: z.string().datetime(),
      sourceArtifactId: z.string().optional(),
    })
    .optional(),
});

export type ConsentPreferences = z.infer<typeof ConsentPreferences>;
export type PatientContact = z.infer<typeof PatientContact>;
export type PatientBio = z.infer<typeof PatientBio>;
