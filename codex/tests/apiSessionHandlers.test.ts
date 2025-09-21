import { describe, expect, it, beforeEach } from "vitest";
import type { IncomingMessage, ServerResponse } from "node:http";
import sessionHandler from "../../api/session/index.js";
import bioHandler from "../../api/session/bio.js";
import confirmHandler from "../../api/session/bio/confirm.js";
import eventHandler from "../../api/session/events/[event].js";
import pinHandler from "../../api/session/pin.js";
import { resetSessionRuntime } from "../server/sessionRuntime/index.js";

interface MockRequestOptions {
  method: string;
  url: string;
  headers?: Record<string, string>;
  body?: unknown;
}

const createRequest = ({ method, url, headers, body }: MockRequestOptions): IncomingMessage => {
  const payload = body ? Buffer.from(JSON.stringify(body)) : null;
  return {
    method,
    url,
    headers: {
      ...(headers ?? {}),
    },
    async *[Symbol.asyncIterator]() {
      if (payload) {
        yield payload;
      }
    },
  } as unknown as IncomingMessage;
};

const createResponse = () => {
  const headers = new Map<string, unknown>();
  let body = "";
  const res = {
    statusCode: 200,
    setHeader(name: string, value: unknown) {
      headers.set(name.toLowerCase(), value);
    },
    getHeader(name: string) {
      return headers.get(name.toLowerCase());
    },
    end(chunk?: unknown) {
      if (chunk) {
        body = chunk.toString();
      }
    },
  };
  Object.defineProperty(res, "headers", {
    get() {
      return Object.fromEntries(headers.entries());
    },
  });
  Object.defineProperty(res, "body", {
    get() {
      return body;
    },
  });
  return res as unknown as ServerResponse & { body: string; headers: Record<string, string> };
};

const runHandler = async (
  handler: (req: IncomingMessage, res: ServerResponse) => unknown,
  options: MockRequestOptions
) => {
  const req = createRequest(options);
  const res = createResponse();
  await handler(req, res);
  const payload = res.body ? JSON.parse(res.body) : undefined;
  return { status: res.statusCode, body: payload, headers: res.headers };
};

const identityHeaders = (sessionId: string, clinicianId: string): Record<string, string> => ({
  "x-session-id": sessionId,
  cookie: `codex_session=${sessionId}`,
  "x-clinician-id": clinicianId,
});

const SESSION_A = "11111111-2222-3333-4444-555555555555";
const SESSION_B = "66666666-7777-8888-9999-aaaaaaaaaaaa";
const CLINICIAN_A = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const CLINICIAN_B = "11111111-aaaa-bbbb-cccc-222222222222";

describe("API session handlers", () => {
  beforeEach(() => {
    resetSessionRuntime();
    process.env.PIN_HASH_PEPPER = "test-pepper";
  });

  it("returns 400 when identifiers are missing", async () => {
    const result = await runHandler(sessionHandler, {
      method: "GET",
      url: "/api/session",
      headers: {},
    });

    expect(result.status).toBe(400);
    expect(result.body.error).toMatch(/Missing session/);
  });

  it("returns the session snapshot when identifiers provided", async () => {
    const result = await runHandler(sessionHandler, {
      method: "GET",
      url: "/api/session",
      headers: identityHeaders(SESSION_A, CLINICIAN_A),
    });

    expect(result.status).toBe(200);
    expect(result.body.record.caseId).toBe(SESSION_A);
    expect(result.body.record.clinicianId).toBe(CLINICIAN_A);
    expect(result.body.state).toBe("BIO_INTAKE");
  });

  it("persists bio updates via repository", async () => {
    await runHandler(sessionHandler, {
      method: "GET",
      url: "/api/session",
      headers: identityHeaders(SESSION_B, CLINICIAN_B),
    });

    const update = await runHandler(bioHandler, {
      method: "POST",
      url: "/api/session/bio",
      headers: identityHeaders(SESSION_B, CLINICIAN_B),
      body: {
        patient: { firstName: "Ada" },
        consent: { dataStorage: true, photography: true },
      },
    });

    expect(update.status).toBe(200);
    expect(update.body.record.patient.firstName).toBe("Ada");

    const confirm = await runHandler(confirmHandler, {
      method: "POST",
      url: "/api/session/bio/confirm",
      headers: identityHeaders(SESSION_B, CLINICIAN_B),
    });

    expect(confirm.status).toBe(409);
    expect(confirm.body.missingFields.length).toBeGreaterThan(0);

    const snapshot = await runHandler(sessionHandler, {
      method: "GET",
      url: "/api/session",
      headers: identityHeaders(SESSION_B, CLINICIAN_B),
    });

    expect(snapshot.body.record.patient.firstName).toBe("Ada");
  });

  it("rejects access when clinician headers do not match", async () => {
    await runHandler(sessionHandler, {
      method: "GET",
      url: "/api/session",
      headers: identityHeaders(SESSION_A, CLINICIAN_A),
    });

    const result = await runHandler(sessionHandler, {
      method: "GET",
      url: "/api/session",
      headers: identityHeaders(SESSION_A, CLINICIAN_B),
    });

    expect(result.status).toBe(403);
    expect(result.body.error).toMatch(/not authorized/);
  });

  it("handles session events", async () => {
    await runHandler(sessionHandler, {
      method: "GET",
      url: "/api/session",
      headers: identityHeaders(SESSION_A, CLINICIAN_A),
    });

    const rollback = await runHandler(eventHandler, {
      method: "POST",
      url: "/api/session/events/BIO_CONFIRMED",
      headers: identityHeaders(SESSION_A, CLINICIAN_A),
    });

    expect(rollback.status).toBe(200);
    expect(rollback.body.state).toBe("WOUND_IMAGING");

    const snapshot = await runHandler(sessionHandler, {
      method: "GET",
      url: "/api/session",
      headers: identityHeaders(SESSION_A, CLINICIAN_A),
    });

    expect(snapshot.body.state).toBe("WOUND_IMAGING");
  });

  it("issues a clinician PIN", async () => {
    await runHandler(sessionHandler, {
      method: "GET",
      url: "/api/session",
      headers: identityHeaders(SESSION_A, CLINICIAN_A),
    });

    const response = await runHandler(pinHandler, {
      method: "POST",
      url: "/api/session/pin",
      headers: identityHeaders(SESSION_A, CLINICIAN_A),
    });

    expect(response.status).toBe(200);
    expect(response.body.pin).toMatch(/^[0-9]{6}$/);
    expect(typeof response.body.issuedAt).toBe("string");
    expect(response.body.snapshot.record.storageMeta.pinIssuedAt).toBe(response.body.issuedAt);
  });
});
