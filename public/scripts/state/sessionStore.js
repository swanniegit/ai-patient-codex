const defaultState = {
  snapshot: null,
  phase: "loading",
  message: "Loading session...",
  error: null,
};

const normalizeNotes = (value) => {
  if (Array.isArray(value)) {
    return value;
  }
  if (typeof value === "string") {
    return value
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
  }
  return undefined;
};

const normalizePatientPatch = (patch = {}) => {
  const next = { ...patch };
  if (Object.prototype.hasOwnProperty.call(patch, "notes")) {
    next.notes = normalizeNotes(patch.notes);
  }
  return next;
};

const mergeSnapshotWithPatch = (snapshot, patch) => {
  if (!patch) return snapshot;
  const patientPatch = normalizePatientPatch(patch.patient ?? {});
  const consentPatch = patch.consent ?? {};

  const nextConsent = {
    ...(snapshot.record.patient.consent ?? {}),
    ...consentPatch,
  };

  const nextPatient = {
    ...snapshot.record.patient,
    ...patientPatch,
    consent: nextConsent,
  };

  const nextRecord = {
    ...snapshot.record,
    patient: nextPatient,
    updatedAt: new Date().toISOString(),
  };

  const nextBio = snapshot.bio
    ? {
        ...snapshot.bio,
        patient: nextPatient,
      }
    : snapshot.bio;

  return {
    ...snapshot,
    record: nextRecord,
    bio: nextBio,
  };
};

export const createSessionStore = (initialState = defaultState) => {
  let state = { ...defaultState, ...initialState };
  const listeners = new Set();

  const notify = () => {
    listeners.forEach((listener) => listener(state));
  };

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      listener(state);
      return () => listeners.delete(listener);
    },
    setState(patch) {
      state = { ...state, ...patch };
      notify();
    },
    update(updater) {
      state = updater(state);
      notify();
    },
    applyLocalPatch(patch) {
      if (!state.snapshot) return;
      state = {
        ...state,
        snapshot: mergeSnapshotWithPatch(state.snapshot, patch),
      };
      notify();
    },
  };
};
