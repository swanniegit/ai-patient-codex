import type { IncomingMessage, ServerResponse } from "node:http";

export const sendJson = (res: ServerResponse, status: number, payload: unknown) => {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(payload));
};

export const sendMethodNotAllowed = (res: ServerResponse, allowed: string[]) => {
  res.setHeader("Allow", allowed.join(", "));
  sendJson(res, 405, { error: "Method not allowed" });
};

export const readJsonBody = async <T = unknown>(req: IncomingMessage): Promise<T> => {
  const chunks: Uint8Array[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  if (!chunks.length) {
    return {} as T;
  }
  try {
    const body = Buffer.concat(chunks).toString("utf8");
    return JSON.parse(body) as T;
  } catch (error) {
    const err = new Error("INVALID_JSON");
    err.name = "INVALID_JSON";
    throw err;
  }
};

export const handleError = (res: ServerResponse, error: unknown) => {
  if (error instanceof Error && error.name === "INVALID_JSON") {
    sendJson(res, 400, { error: "Invalid JSON body" });
    return;
  }
  console.error(error);
  sendJson(res, 500, { error: "Unexpected server error" });
};
