// deno-lint-ignore no-explicit-any
export const memoize = <A extends Array<any>, B>(
  fn: (...args: A) => B,
): ((...args: A) => B) & { hits: number; misses: number } => {
  // deno-lint-ignore no-explicit-any
  let rootStore: Map<unknown, any> | Record<any, any>;

  const memoized = Object.assign(
    (...args: A): B => {
      if (!rootStore) {
        rootStore = typeof args[0] === "object" ? new Map() : {};
      }

      let store = rootStore;
      for (let i = 0; i < args.length - 1; i++) {
        if (store instanceof Map) {
          if (store.has(args[i])) {
            store = store.get(args[i]);
          } else {
            const next = typeof args[i] === "object" ? new Map() : {};
            store.set(args[i], next);
            store = next; // <-- descend!
          }
        } else {
          if (args[i] in store) {
            store = store[args[i]];
          } else {
            const next = typeof args[i] === "object" ? new Map() : {};
            store[args[i]] = next;
            store = next; // <-- descend!
          }
        }
      }

      const lastArg = args[args.length - 1];

      if (store instanceof Map) {
        if (store.has(lastArg)) {
          memoized.hits++;
          return store.get(lastArg);
        }
        memoized.misses++;
        const val = fn(...args);
        store.set(lastArg, val);
        return val;
      } else {
        if (lastArg in store) {
          memoized.hits++;
          return store[lastArg];
        }
        memoized.misses++;
        const val = fn(...args);
        store[lastArg] = val;
        return val;
      }
    },
    { hits: 0, misses: 0 },
  );

  return memoized;
};
