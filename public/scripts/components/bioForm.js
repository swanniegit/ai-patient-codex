import { mergePayloads } from "../utils/mergePayloads.js";

export const registerBioForm = ({ form, checkButton, confirmButton, store, client }) => {
  if (!form) {
    throw new Error("Missing bio form element");
  }

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

  // Removed markUnsaved and applyPatch functions to eliminate keystroke refreshing

  // COMPLETELY MANUAL SAVING - No automatic saves, no refreshing!
  // All changes are collected and saved only when user clicks "Confirm bio intake"

  // Collect all form changes without saving
  const collectFormData = () => {
    const formData = new FormData(form);
    const allPatches = {};

    // Collect all field data
    for (const [key, value] of formData.entries()) {
      const field = form.elements[key];
      if (field) {
        const patch = buildPatchForField(field);
        if (patch) {
          Object.assign(allPatches, patch);
        }
      }
    }

    // Handle text fields that might not be in FormData
    form.querySelectorAll('input[type="text"], input[type="date"], input[type="number"], textarea').forEach(field => {
      if (field.name && field.value.trim()) {
        const patch = buildPatchForField(field);
        if (patch) {
          Object.assign(allPatches, patch);
        }
      }
    });

    return allPatches;
  };

  // Manual validation with Check Input button
  if (checkButton) {
    checkButton.addEventListener("click", async () => {
      // Collect form data and validate
      const allData = collectFormData();

      store.setState({ phase: "checking", message: "Checking input...", error: null });

      try {
        // Send data to server for validation without saving
        const response = await client.updateBio(allData);

        if (response.bio.missingFields.length === 0 && response.bio.consentValidated) {
          // Validation passed - enable confirm button
          confirmButton.disabled = false;
          store.setState({
            phase: "ready",
            message: "✅ All required fields complete - ready to confirm",
            error: null
          });
        } else {
          // Validation failed - show what's missing
          const missing = response.bio.missingFields.join(", ") || "consent";
          confirmButton.disabled = true;
          store.setState({
            phase: "ready",
            message: `❌ Missing: ${missing}`,
            error: null
          });
        }
      } catch (error) {
        confirmButton.disabled = true;
        const message = error instanceof Error ? error.message : "Validation failed";
        store.setState({ phase: "error", message, error: message });
      }
    });
  }

  if (confirmButton) {
    confirmButton.addEventListener("click", async () => {
      // Collect all form data at once and save
      const allData = collectFormData();
      if (Object.keys(allData).length > 0) {
        pendingPatch = allData;
        await flushPatch();
      }
    store.setState({ phase: "confirming", message: "Confirming...", error: null });
     try {
       const result = await client.confirmBio();
        if (result.ok) {
          const snapshot = await client.getSnapshot();
          store.setState({ snapshot, phase: "ready", message: "Bio intake complete", error: null });
          try {
            const response = await client.generatePin();
            const nextSnapshot = response?.snapshot ?? snapshot;
            store.setState({
              snapshot: nextSnapshot,
              phase: "ready",
              message: response?.pin ? `Bio intake complete · PIN ${response.pin} · Proceeding to wound imaging...` : "Bio intake complete · Proceeding to wound imaging...",
              error: null,
            });

            // Automatically progress to wound imaging after a brief delay
            setTimeout(async () => {
              try {
                await client.triggerEvent("BIO_CONFIRMED");
                const finalSnapshot = await client.getSnapshot();
                store.setState({
                  snapshot: finalSnapshot,
                  phase: "ready",
                  message: "Ready for wound imaging",
                  error: null,
                });
              } catch (progressError) {
                console.error("Failed to progress to wound imaging:", progressError);
                store.setState({
                  phase: "ready",
                  message: "Bio complete - please proceed manually to wound imaging",
                  error: null,
                });
              }
            }, 2000); // 2 second delay to show completion message

          } catch (pinError) {
            const message = pinError instanceof Error ? pinError.message : "PIN generation failed";
            store.setState({ phase: "ready", message, error: message });
          }
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
