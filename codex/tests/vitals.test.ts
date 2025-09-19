import { VitalsAgent } from "../agents/VitalsAgent";
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

describe("VitalsAgent", () => {
  it("asks for unit when temperature unit missing", async () => {
    const agent = new VitalsAgent(deps);
    const record = createStubCaseRecord();
    const context: AgentRunContext = {
      record,
      artifacts: [],
    };

    const result = await agent.run(
      {
        vitals: {
          temperature: {
            value: 37,
            capturedAt: new Date().toISOString(),
            site: "oral",
          },
        },
      },
      context
    );

    expect(result.data.missingUnits).toContain("temperature");
  });
});
