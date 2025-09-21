import { createSessionClient } from "./api/sessionClient.js";
import { createSessionStore } from "./state/sessionStore.js";
import { registerBioForm } from "./components/bioForm.js";
import { registerSessionRenderer } from "./components/sessionRenderer.js";

const elements = {
  form: document.querySelector("#bio-form"),
  missingList: document.querySelector("#missing-fields"),
  consentBadge: document.querySelector("#consent-status"),
  statusMessage: document.querySelector("#save-status"),
  recordMeta: document.querySelector("#record-meta"),
  confirmButton: document.querySelector("#confirm-bio"),
  timeline: document.querySelector("#state-timeline"),
  sessionPhase: document.querySelector("#session-phase"),
};

const IDENTITY_STORAGE_KEY = "codex.session.identity";

const uuid = () => {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Math.random().toString(16).slice(2, 10)}-${Math.random().toString(16).slice(2, 6)}-${Math.random()
    .toString(16)
    .slice(2, 6)}-${Math.random().toString(16).slice(2, 6)}-${Math.random().toString(16).slice(2, 14)}`;
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const stripPrefix = (value, prefixes) => {
  if (!value) return undefined;
  let candidate = value.trim();
  for (const prefix of prefixes) {
    if (candidate.toLowerCase().startsWith(prefix)) {
      candidate = candidate.slice(prefix.length);
      break;
    }
  }
  return candidate;
};

const normalizeIdentityValue = (value, prefixes) => {
  if (!value) return undefined;
  if (UUID_REGEX.test(value)) return value;
  const candidate = stripPrefix(value, prefixes);
  if (candidate && UUID_REGEX.test(candidate)) {
    return candidate;
  }
  return undefined;
};

const ensureIdentity = () => {
  try {
    const raw = localStorage.getItem(IDENTITY_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const sessionId = normalizeIdentityValue(parsed.sessionId, ["case-", "session-", "sid-"]);
      const clinicianId = normalizeIdentityValue(parsed.clinicianId, ["clinician-", "cid-"]);
      if (sessionId && clinicianId) {
        document.cookie = `codex_session=${sessionId}; Path=/; SameSite=Lax`;
        const normalized = { sessionId, clinicianId };
        localStorage.setItem(IDENTITY_STORAGE_KEY, JSON.stringify(normalized));
        return normalized;
      }
    }
  } catch {
    // ignore storage errors
  }

  const identity = {
    sessionId: uuid(),
    clinicianId: uuid(),
  };

  try {
    localStorage.setItem(IDENTITY_STORAGE_KEY, JSON.stringify(identity));
  } catch {
    // ignore storage failures
  }

  document.cookie = `codex_session=${identity.sessionId}; Path=/; SameSite=Lax`;

  return identity;
};

const apiBase = document.body?.dataset.apiBase ?? "/api";
const store = createSessionStore();
const identity = ensureIdentity();
const client = createSessionClient(apiBase, identity);
client.setIdentity(identity);

registerSessionRenderer({ store, elements });
registerBioForm({
  form: elements.form,
  confirmButton: elements.confirmButton,
  store,
  client,
});

const bootstrap = async () => {
  store.setState({ phase: "loading", message: "Loading session...", error: null });
  try {
    const snapshot = await client.getSnapshot();
    store.setState({ snapshot, phase: "ready", message: "Ready", error: null });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return;
    }
    const message = error instanceof Error ? error.message : "Failed to load session";
    store.setState({ phase: "error", message, error: message });
  }
};

bootstrap();
