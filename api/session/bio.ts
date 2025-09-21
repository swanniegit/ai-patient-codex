import type { IncomingMessage, ServerResponse } from "node:http";
import { createSessionController } from "../../codex/server/sessionRuntime";
import { handleError, readJsonBody, sendJson, sendMethodNotAllowed } from "../../codex/server/httpHelpers";
import type { BioAgentInput } from "../../codex/agents/BioAgent";

const resolveCaseId = (req: IncomingMessage): string => {
  const header = req.headers["x-case-id"];
  if (typeof header === "string" && header.trim().length > 0) {
    return header.trim();
  }
  const path = req.url ?? "/api/session/bio";
  try {
    const url = new URL(path, `http://${req.headers.host ?? "localhost"}`);
    const value = url.searchParams.get("caseId");
    if (value && value.trim().length > 0) {
      return value.trim();
    }
  } catch {
    // ignore
  }
  return "demo-case";
};

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    if (req.method === "POST") {
      const body = await readJsonBody<Partial<BioAgentInput>>(req);
      const controller = await createSessionController({ caseId: resolveCaseId(req) });
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
