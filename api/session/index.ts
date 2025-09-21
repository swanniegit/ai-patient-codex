import type { IncomingMessage, ServerResponse } from "node:http";
import { createSessionController } from "../../codex/server/sessionRuntime/index.js";
import { extractRequestContext } from "../../codex/server/requestContext";
import { handleError, sendJson, sendMethodNotAllowed } from "../../codex/server/httpHelpers";

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    if (req.method === "GET") {
      const { caseId, clinicianId } = extractRequestContext(req);
      const controller = await createSessionController({ caseId, clinicianId });
      const snapshot = await controller.getSnapshot();
      sendJson(res, 200, snapshot);
      return;
    }

    sendMethodNotAllowed(res, ["GET"]);
  } catch (error) {
    handleError(res, error);
  }
}
