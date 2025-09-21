import { Agent } from "./AgentInterface.js";
import { AgentDependencies, AgentResult, AgentRunContext } from "./AgentContext.js";
import { WoundPhoto } from "../schemas/WoundPhoto.js";

export interface WoundImagingInput {
  photos: WoundPhoto[];
}

export interface WoundImagingOutput {
  approvedPhotos: WoundPhoto[];
  retakeNeeded: boolean;
  issues: string[];
}

export class WoundImagingAgent implements Agent<WoundImagingInput, WoundImagingOutput> {
  public readonly name = "WoundImagingAgent";
  public readonly promptPath = "prompts/imaging.md";

  constructor(private readonly deps: AgentDependencies) {}

  async run(input: WoundImagingInput, context: AgentRunContext): Promise<AgentResult<WoundImagingOutput>> {
    const issues: string[] = [];
    const approved = input.photos.filter((photo) => {
      const qa = photo.qaChecklist ?? {};
      const framingOk = qa.framing !== "fail";
      const focusOk = qa.focus !== "fail";
      const lightingOk = qa.lighting !== "fail";
      if (!framingOk) issues.push(`Photo ${photo.id} framing flagged`);
      if (!focusOk) issues.push(`Photo ${photo.id} focus flagged`);
      if (!lightingOk) issues.push(`Photo ${photo.id} lighting flagged`);
      if (!photo.scalePresent) issues.push(`Photo ${photo.id} missing scale reference`);
      return framingOk && focusOk && lightingOk;
    });

    const retakeNeeded = issues.some((msg) => msg.includes("flagged")) || approved.length === 0;

    const nextRecord = {
      ...context.record,
      wounds: {
        ...context.record.wounds,
        photos: input.photos,
        overrides: {
          ...context.record.wounds.overrides,
          requiresRetake: retakeNeeded,
        },
      },
      updatedAt: new Date().toISOString(),
    };

    if (context.autosave) {
      await context.autosave(nextRecord);
    }

    return {
      data: {
        approvedPhotos: approved,
        retakeNeeded,
        issues,
      },
      updatedRecord: nextRecord,
      followUps: retakeNeeded ? ["Confirm if retake is possible"] : issues,
      provenance: [
        {
          agent: this.name,
          field: "wounds.photos",
          timestamp: new Date().toISOString(),
          notes: retakeNeeded ? "Awaiting clearer imaging" : "Imaging QA placeholder run",
        },
      ],
    };
  }
}

export const createWoundImagingAgent = (deps: AgentDependencies) => new WoundImagingAgent(deps);
