const defaultState = {
  snapshot: null,
  phase: "loading",
  message: "Loading session...",
  error: null,
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
  };
};
