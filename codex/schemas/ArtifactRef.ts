import { z } from "zod";

/**
 * Artifact references describe any external asset captured during the session
 * (e.g., wound photos, audio notes). Keeping this modular allows agents to
 * attach rich metadata without the schema growing monolithic.
 */
export const ArtifactRef = z.object({
  id: z.string().min(1, "artifact id required"),
  kind: z.enum(["image", "audio", "document", "text", "other"]).default("other"),
  uri: z.string().min(1, "artifact uri required"),
  capturedAt: z.string().datetime().optional(),
  capturedBy: z.string().optional(),
  description: z.string().optional(),
  metadata: z.record(z.any()).optional(),
  qa: z
    .object({
      confidence: z.number().min(0).max(1).optional(),
      notes: z.string().optional(),
    })
    .optional(),
});

export type ArtifactRef = z.infer<typeof ArtifactRef>;
