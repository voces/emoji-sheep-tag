export const yieldUntil = function* <T>(
  fn: () => T,
  { timeout = 50 }: {
    /** In seconds */
    timeout?: number;
  } = {},
) {
  timeout *= 1000;
  const start = Date.now();
  while (true) {
    try {
      return fn();
    } catch (err) {
      if (Date.now() - timeout > start) throw err;
    }
    yield;
  }
};
