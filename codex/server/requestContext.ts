import type { IncomingMessage } from "node:http";
import { MissingIdentityError } from "./errors.js";

const SESSION_HEADER = "x-session-id";
const CLINICIAN_HEADER = "x-clinician-id";
const SESSION_COOKIE = "codex_session";

const parseCookies = (value: string | undefined) => {
  if (!value) return {} as Record<string, string>;
  return value.split(";").reduce<Record<string, string>>((acc, part) => {
    const [rawKey, rawVal] = part.split("=");
    if (!rawKey) return acc;
    const key = rawKey.trim();
    const val = rawVal ? decodeURIComponent(rawVal.trim()) : "";
    if (key) acc[key] = val;
    return acc;
  }, {});
};

const normalize = (value: unknown) => {
  if (!value) return undefined;
  if (Array.isArray(value)) {
    return normalize(value[0]);
  }
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }
  return undefined;
};

export interface RequestContext {
  caseId: string;
  clinicianId: string;
}

export const extractRequestContext = (req: IncomingMessage): RequestContext => {
  const headerSession = normalize(req.headers[SESSION_HEADER]);
  const headerClinician = normalize(req.headers[CLINICIAN_HEADER]);

  const cookies = parseCookies(normalize(req.headers.cookie));
  const cookieSession = normalize(cookies[SESSION_COOKIE]);

  const caseId = headerSession ?? cookieSession;
  const clinicianId = headerClinician;

  if (!caseId || !clinicianId) {
    throw new MissingIdentityError();
  }

  return { caseId, clinicianId };
};
