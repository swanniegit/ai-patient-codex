import { WoundImagingAgent } from "../agents/WoundImagingAgent";
import { AgentDependencies, AgentRunContext } from "../agents/AgentContext";
import { createStubCaseRecord } from "./testUtils";

const deps: AgentDependencies = {
  promptLoader: {
    load: async () => "",
  },
  logger: {
    info: () => undefined,
  },
};

describe("WoundImagingAgent", () => {
  it("flags retake when focus fails", async () => {
    const agent = new WoundImagingAgent(deps);
    const record = createStubCaseRecord();
    const context: AgentRunContext = {
      record,
      artifacts: [],
    };

    const result = await agent.run(
      {
        photos: [
          {
            id: "photo-1",
            kind: "image",
            uri: "file://photo-1.jpg",
            qaChecklist: {
              framing: "pass",
              focus: "fail",
              lighting: "pass",
              scale: "pass",
              identifier: "unknown",
            },
            scalePresent: true,
          },
        ],
      },
      context
    );

    expect(result.data.retakeNeeded).toBe(true);
    expect(result.data.issues.some((issue) => issue.includes("focus"))).toBe(true);
  });
});
