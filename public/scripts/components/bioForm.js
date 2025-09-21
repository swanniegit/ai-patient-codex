import { mergePayloads } from "../utils/mergePayloads.js";

const SAVE_DEBOUNCE_MS = 180;

export const registerBioForm = ({ form, confirmButton, store, client }) => {
  if (!form) {
    throw new Error("Missing bio form element");
  }

  let debounceTimer = null;
  let pendingPatch = null;
  let inFlightController = null;

  const flushPatch = async () => {
    if (!pendingPatch) return;
    inFlightController?.abort();
    const controller = new AbortController();
    inFlightController = controller;
    const patch = pendingPatch;
    pendingPatch = null;

    store.setState({ phase: "saving", message: "Saving...", error: null });
    try {
      const snapshot = await client.updateBio(patch, controller.signal);
      store.setState({ snapshot, phase: "ready", message: "Saved", error: null });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return;
      }
      const message = error instanceof Error ? error.message : "Failed to save";
      store.setState({ phase: "error", message, error: message });
    } finally {
      inFlightController = null;
    }
  };

  const schedulePatch = (patch) => {
    pendingPatch = mergePayloads(pendingPatch, patch);
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    debounceTimer = setTimeout(() => {
      flushPatch();
    }, SAVE_DEBOUNCE_MS);
  };

  const applyPatch = (patch) => {
    store.applyLocalPatch(patch);
    store.setState({ phase: "saving", message: "Saving...", error: null });
    schedulePatch(patch);
  };

  form.addEventListener("input", (event) => {
    const patch = buildPatchForField(event.target);
    if (!patch) return;
    applyPatch(patch);
  });

  form.addEventListener("change", (event) => {
    const patch = buildPatchForField(event.target);
    if (!patch) return;
    applyPatch(patch);
  });

  if (confirmButton) {
    confirmButton.addEventListener("click", async () => {
      if (pendingPatch) {
        await flushPatch();
      }
      store.setState({ phase: "confirming", message: "Confirming...", error: null });
      try {
        const result = await client.confirmBio();
        if (result.ok) {
          const snapshot = await client.getSnapshot();
          store.setState({ snapshot, phase: "ready", message: "Bio intake complete", error: null });
        } else {
          const missing = result.missingFields.join(", ") || "fields";
          store.setState({
            phase: "ready",
            message: `Bio still incomplete: ${missing}`,
            error: null,
          });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Confirmation failed";
        store.setState({ phase: "error", message, error: message });
      }
    });
  }
};

const buildPatchForField = (target) => {
  if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) {
    return null;
  }

  const { name } = target;
  if (!name) return null;

  if (target.type === "checkbox") {
    return {
      patient: {},
      consent: {
        [name]: target.checked,
      },
    };
  }

  switch (name) {
    case "age": {
      const trimmed = target.value.trim();
      return {
        patient: {
          age: trimmed.length ? Number(trimmed) : undefined,
        },
        consent: {},
      };
    }
    case "notes": {
      const lines = target.value
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0);
      return {
        patient: {
          notes: lines,
        },
        consent: {},
      };
    }
    default: {
      return {
        patient: {
          [name]: target.value,
        },
        consent: {},
      };
    }
  }
};
