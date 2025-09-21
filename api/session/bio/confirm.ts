import type { IncomingMessage, ServerResponse } from "node:http";
import { createSessionController } from "../../../codex/server/sessionRuntime/index.js";
import { extractRequestContext } from "../../../codex/server/requestContext.js";
import { handleError, sendJson, sendMethodNotAllowed } from "../../../codex/server/httpHelpers.js";

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    if (req.method === "POST") {
      const { caseId, clinicianId } = extractRequestContext(req);
      const controller = await createSessionController({ caseId, clinicianId });
      const result = await controller.confirmBio();
      sendJson(res, result.ok ? 200 : 409, result);
      return;
    }

    sendMethodNotAllowed(res, ["POST"]);
  } catch (error) {
    handleError(res, error);
  }
}
