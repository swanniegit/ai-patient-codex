import { z } from "zod";

const TissueBreakdown = z
  .object({
    granulationPct: z.number().min(0).max(100).default(0),
    sloughPct: z.number().min(0).max(100).default(0),
    necroticPct: z.number().min(0).max(100).default(0),
    epithelialPct: z.number().min(0).max(100).default(0),
  })
  .superRefine((data, ctx) => {
    const total = data.granulationPct + data.sloughPct + data.necroticPct + data.epithelialPct;
    if (total > 100) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Tissue percentages must not exceed 100",
      });
    }
  });

const InfectionInflammation = z.object({
  odor: z.enum(["none", "mild", "moderate", "strong"]).optional(),
  erythema: z.enum(["none", "localized", "spreading"]).optional(),
  pain: z.enum(["none", "new", "increasing", "unchanged"]).optional(),
  notes: z.string().optional(),
});

const Moisture = z.object({
  exudate: z.enum(["none", "scant", "moderate", "heavy"]).optional(),
  consistency: z.enum(["serous", "sanguineous", "serosanguineous", "purulent", "fibrinous", "unknown"]).optional(),
  dressingSaturation: z.enum(["dry", "moist", "saturated", "leaking"]).optional(),
});

const Edge = z.object({
  condition: z.enum(["attached", "detached", "rolled", "calloused", "macerated", "unknown"]).optional(),
  underminingDepthCm: z.number().min(0).optional(),
  epibole: z.boolean().optional(),
});

export const TimeBlock = z.object({
  tissue: TissueBreakdown.optional(),
  infectionInflammation: InfectionInflammation.optional(),
  moisture: Moisture.optional(),
  edge: Edge.optional(),
  notes: z.array(z.string()).default([]),
  capturedAt: z.string().datetime().optional(),
  assessedBy: z.string().optional(),
});

export type TimeBlock = z.infer<typeof TimeBlock>;
export type TissueBreakdown = z.infer<typeof TissueBreakdown>;
