import type { IncomingMessage, ServerResponse } from "node:http";
import { createSessionController } from "../../../codex/server/sessionRuntime/index.js";
import { extractRequestContext } from "../../../codex/server/requestContext.js";
import { handleError, sendJson, sendMethodNotAllowed } from "../../../codex/server/httpHelpers.js";
import { SESSION_EVENTS, SessionEvent } from "../../../codex/state/transitions.js";

const toEvent = (value: string | null): SessionEvent | null => {
  if (!value) return null;
  const candidate = value.toUpperCase() as SessionEvent;
  return SESSION_EVENTS.includes(candidate) ? candidate : null;
};

const resolveEventFromRequest = (req: IncomingMessage): SessionEvent | null => {
  const url = req.url ?? "/api/session/events";
  try {
    const parsed = new URL(url, `http://${req.headers.host ?? "localhost"}`);
    const parts = parsed.pathname.split("/").filter(Boolean);
    const event = parts[parts.length - 1] ?? null;
    return toEvent(event);
  } catch {
    return null;
  }
};

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    if (req.method !== "POST") {
      sendMethodNotAllowed(res, ["POST"]);
      return;
    }

    const event = resolveEventFromRequest(req);
    if (!event) {
      sendJson(res, 400, { error: "Unsupported session event" });
      return;
    }

    const { caseId, clinicianId } = extractRequestContext(req);
    const controller = await createSessionController({ caseId, clinicianId });
    const snapshot = await controller.triggerEvent(event);
    sendJson(res, 200, snapshot);
  } catch (error) {
    handleError(res, error);
  }
}
