export const registerBioForm = ({ form, checkButton, confirmButton, store, client }) => {
  if (!form) {
    throw new Error("Missing bio form element");
  }

  // Simple function to collect all form data as JSON
  const collectFormData = () => {
    const formData = new FormData(form);
    const data = {
      patient: {},
      consent: {}
    };

    // Get all text inputs
    for (const [key, value] of formData.entries()) {
      const field = form.elements[key];
      if (!field) continue;

      if (field.type === "checkbox") {
        data.consent[key] = field.checked;
      } else if (key === "age") {
        data.patient[key] = value ? Number(value) : undefined;
      } else if (key === "notes") {
        data.patient[key] = value.split('\n').filter(line => line.trim());
      } else {
        data.patient[key] = value || undefined;
      }
    }

    return data;
  };

  // Check Input button - just validate without changing anything
  if (checkButton) {
    checkButton.addEventListener("click", async () => {
      const data = collectFormData();

      store.setState({ phase: "checking", message: "Checking input...", error: null });

      try {
        const response = await client.updateBio(data);

        if (response.bio.missingFields.length === 0 && response.bio.consentValidated) {
          confirmButton.disabled = false;
          store.setState({
            phase: "ready",
            message: "✅ All required fields complete - ready to confirm",
            error: null
          });
        } else {
          const missing = response.bio.missingFields.join(", ") || "consent";
          store.setState({
            phase: "ready",
            message: `❌ Missing: ${missing}`,
            error: null
          });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Validation failed";
        store.setState({ phase: "error", message, error: message });
      }
    });
  }

  // Confirm button - send whatever data we have
  if (confirmButton) {
    confirmButton.addEventListener("click", async () => {
      const data = collectFormData();

      store.setState({ phase: "saving", message: "Saving...", error: null });

      try {
        // Save the data
        await client.updateBio(data);

        store.setState({ phase: "confirming", message: "Confirming...", error: null });

        // Confirm bio intake
        const result = await client.confirmBio();

        if (result.ok) {
          const snapshot = await client.getSnapshot();
          store.setState({ snapshot, phase: "ready", message: "Bio intake complete", error: null });

          // Generate PIN and proceed
          try {
            const response = await client.generatePin();
            const nextSnapshot = response?.snapshot ?? snapshot;
            store.setState({
              snapshot: nextSnapshot,
              phase: "ready",
              message: response?.pin ? `Bio intake complete · PIN ${response.pin} · Proceeding to wound imaging...` : "Bio intake complete · Proceeding to wound imaging...",
              error: null,
            });

            // Auto-progress to wound imaging after brief delay
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
            }, 2000);

          } catch (pinError) {
            const message = pinError instanceof Error ? pinError.message : "PIN generation failed";
            store.setState({ phase: "ready", message, error: message });
          }
        } else {
          store.setState({
            phase: "ready",
            message: "Bio intake completed with available data",
            error: null,
          });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Save failed";
        store.setState({ phase: "error", message, error: message });
      }
    });
  }
};