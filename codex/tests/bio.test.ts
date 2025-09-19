import { BioAgent } from "../agents/BioAgent";
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

describe("BioAgent", () => {
  it("marks consent missing when not provided", async () => {
    const agent = new BioAgent(deps);
    const record = createStubCaseRecord({
      patient: {
        patientId: "123e4567-e89b-12d3-a456-426614174099",
        firstName: "Jane",
        consent: {
          dataStorage: false,
          photography: false,
          sharingToTeamBoard: false,
        },
        notes: [],
      },
    });

    const context: AgentRunContext = {
      record,
      artifacts: [],
    };

    const result = await agent.run(
      {
        patient: {},
        consent: {},
      },
      context
    );

    expect(result.data.consentValidated).toBe(false);
    expect(result.followUps).toContain("consent");
  });
});
