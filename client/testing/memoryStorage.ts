// Deno persists localStorage on disk and shares it between parallel test
// workers and runs, so tests get a per-process in-memory store instead. This
// module must be imported before anything that reads storage at module init.
const createMemoryStorage = (): Storage => {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (key) => data.get(key) ?? null,
    key: (index) => [...data.keys()][index] ?? null,
    removeItem: (key) => void data.delete(key),
    setItem: (key, value) => void data.set(key, String(value)),
  };
};

Object.defineProperty(globalThis, "localStorage", {
  value: createMemoryStorage(),
  configurable: true,
  writable: true,
});
