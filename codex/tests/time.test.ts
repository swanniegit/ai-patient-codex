import { TimeAgent } from "../agents/TimeAgent.js";
import { AgentDependencies, AgentRunContext } from "../agents/AgentContext.js";
import { createStubCaseRecord } from "./testUtils.js";

const deps: AgentDependencies = {
  promptLoader: {
    load: async () => "",
  },
  logger: {
    info: () => undefined,
  },
};

describe("TimeAgent", () => {
  it("flags tissue totals over 100%", async () => {
    const agent = new TimeAgent(deps);
    const record = createStubCaseRecord();
    const context: AgentRunContext = {
      record,
      artifacts: [],
    };

    const result = await agent.run(
      {
        time: {
          tissue: {
            granulationPct: 60,
            sloughPct: 30,
            necroticPct: 20,
            epithelialPct: 10,
          },
        },
      },
      context
    );

    expect(result.data.flags).toContain("Tissue percentages exceed 100%");
  });
});
