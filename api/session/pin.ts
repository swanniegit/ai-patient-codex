import type { IncomingMessage, ServerResponse } from "node:http";
import { createSessionController } from "../../codex/server/sessionRuntime/index.js";
import { extractRequestContext } from "../../codex/server/requestContext.js";
import { handleError, sendJson, sendMethodNotAllowed } from "../../codex/server/httpHelpers.js";
import { hashPin } from "../../codex/crypto/pinHash.js";

const generatePin = (length = 6): string => {
  const min = 10 ** (length - 1);
  const max = 10 ** length;
  return String(Math.floor(Math.random() * (max - min)) + min);
};

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    if (req.method !== "POST") {
      sendMethodNotAllowed(res, ["POST"]);
      return;
    }

    const { caseId, clinicianId } = extractRequestContext(req);
    const controller = await createSessionController({ caseId, clinicianId });
    const pin = generatePin();
    const { hash } = await hashPin(pin);
    const issuedAt = new Date().toISOString();
    const snapshot = await controller.assignPin(hash, issuedAt);

    sendJson(res, 200, {
      pin,
      issuedAt,
      snapshot,
    });
  } catch (error) {
    handleError(res, error);
  }
}
