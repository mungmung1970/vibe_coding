export function createStore(initialState) {
  let state = structuredClone(initialState);
  const listeners = new Set();

  const notify = () => listeners.forEach((listener) => listener(state));

  return {
    get: () => state,
    /** Merge a patch and re-render. */
    set: (patch) => {
      state = { ...state, ...patch };
      notify();
    },
    /**
     * Merge a patch without re-rendering. Used for values the DOM already owns
     * (textarea text, slider positions, streaming answer text) so typing and
     * dragging are never interrupted by a re-render.
     */
    setQuiet: (patch) => {
      state = { ...state, ...patch };
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
