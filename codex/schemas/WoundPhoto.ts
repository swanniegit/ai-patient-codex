import { z } from "zod";
import { ArtifactRef } from "./ArtifactRef";

const QaFlag = z.enum(["pass", "fail", "unknown"]);

export const WoundPhoto = ArtifactRef.extend({
  kind: z.literal("image"),
  site: z.string().optional(),
  orientation: z.enum(["anterior", "posterior", "lateral", "superior", "inferior", "unspecified"]).optional(),
  scalePresent: z.boolean().default(false),
  estimatedScaleCmPerPixel: z.number().positive().optional(),
  qaChecklist: z
    .object({
      framing: QaFlag.default("unknown"),
      focus: QaFlag.default("unknown"),
      lighting: QaFlag.default("unknown"),
      scale: QaFlag.default("unknown"),
      identifier: QaFlag.default("unknown"),
    })
    .default({}),
});

export type WoundPhoto = z.infer<typeof WoundPhoto>;
