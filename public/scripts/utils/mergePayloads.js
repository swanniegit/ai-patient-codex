export const mergePayloads = (current, patch) => {
  if (!patch) return current ?? null;
  if (!current) {
    return normalizePatch(patch);
  }
  const next = normalizePatch(patch);
  return {
    patient: { ...current.patient, ...next.patient },
    consent: { ...current.consent, ...next.consent },
  };
};

const normalizePatch = (patch) => ({
  patient: { ...(patch.patient ?? {}) },
  consent: { ...(patch.consent ?? {}) },
});
