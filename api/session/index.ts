import type { IncomingMessage, ServerResponse } from "node:http";
import { createSessionController } from "../../codex/server/sessionRuntime";
import { handleError, sendJson, sendMethodNotAllowed } from "../../codex/server/httpHelpers";

const DEFAULT_CASE_ID = "demo-case";

const resolveCaseId = (req: IncomingMessage): string => {
  const header = req.headers["x-case-id"];
  if (typeof header === "string" && header.trim().length > 0) {
    return header.trim();
  }
  const path = req.url ?? "/api/session";
  try {
    const url = new URL(path, `http://${req.headers.host ?? "localhost"}`);
    const value = url.searchParams.get("caseId");
    if (value && value.trim().length > 0) {
      return value.trim();
    }
  } catch {
    // ignore URL parse issues and fall back to default
  }
  return DEFAULT_CASE_ID;
};

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    if (req.method === "GET") {
      const controller = await createSessionController({ caseId: resolveCaseId(req) });
      const snapshot = await controller.getSnapshot();
      sendJson(res, 200, snapshot);
      return;
    }

    sendMethodNotAllowed(res, ["GET"]);
  } catch (error) {
    handleError(res, error);
  }
}
