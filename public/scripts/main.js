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

const apiBase = document.body?.dataset.apiBase ?? "/api";
const store = createSessionStore();
const client = createSessionClient(apiBase);

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
