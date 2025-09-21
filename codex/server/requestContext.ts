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

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const sanitizeIdentifier = (value: string | undefined, prefixes: string[]): string | undefined => {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (UUID_REGEX.test(trimmed)) return trimmed;
  for (const prefix of prefixes) {
    if (trimmed.toLowerCase().startsWith(prefix)) {
      const candidate = trimmed.slice(prefix.length);
      if (UUID_REGEX.test(candidate)) {
        return candidate;
      }
    }
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

  const caseId = sanitizeIdentifier(headerSession ?? cookieSession, ["case-", "session-", "sid-"]);
  const clinicianId = sanitizeIdentifier(headerClinician, ["clinician-", "cid-"]);

  if (!caseId || !clinicianId) {
    throw new MissingIdentityError();
  }

  return { caseId, clinicianId };
};
