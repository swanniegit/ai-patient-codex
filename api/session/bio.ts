import type { IncomingMessage, ServerResponse } from "node:http";
import { createSessionController } from "../../codex/server/sessionRuntime";
import { extractRequestContext } from "../../codex/server/requestContext";
import { handleError, readJsonBody, sendJson, sendMethodNotAllowed } from "../../codex/server/httpHelpers";
import type { BioAgentInput } from "../../codex/agents/BioAgent";

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    if (req.method === "POST") {
      const body = await readJsonBody<Partial<BioAgentInput>>(req);
      const { caseId, clinicianId } = extractRequestContext(req);
      const controller = await createSessionController({ caseId, clinicianId });
      const snapshot = await controller.updateBio({
        patient: body.patient ?? {},
        consent: body.consent ?? {},
      });
      sendJson(res, 200, snapshot);
      return;
    }

    sendMethodNotAllowed(res, ["POST"]);
  } catch (error) {
    handleError(res, error);
  }
}
