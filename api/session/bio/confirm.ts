import type { IncomingMessage, ServerResponse } from "node:http";
import { createSessionController } from "../../../codex/server/sessionRuntime";
import { handleError, sendJson, sendMethodNotAllowed } from "../../../codex/server/httpHelpers";

const resolveCaseId = (req: IncomingMessage): string => {
  const header = req.headers["x-case-id"];
  if (typeof header === "string" && header.trim().length > 0) {
    return header.trim();
  }
  const path = req.url ?? "/api/session/bio/confirm";
  try {
    const url = new URL(path, `http://${req.headers.host ?? "localhost"}`);
    const value = url.searchParams.get("caseId");
    if (value && value.trim().length > 0) {
      return value.trim();
    }
  } catch {
    // ignore and fall back
  }
  return "demo-case";
};

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    if (req.method === "POST") {
      const controller = await createSessionController({ caseId: resolveCaseId(req) });
      const result = await controller.confirmBio();
      sendJson(res, result.ok ? 200 : 409, result);
      return;
    }

    sendMethodNotAllowed(res, ["POST"]);
  } catch (error) {
    handleError(res, error);
  }
}
