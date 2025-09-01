export function yieldFor(seconds: number): Generator<void, void, unknown>;
export function yieldFor<T>(
  fn: () => T,
  options?: { timeout?: number },
): Generator<void, T, unknown>;
export function* yieldFor<T>(
  secondsOrFn: number | (() => T),
  options: { timeout?: number } = {},
) {
  if (typeof secondsOrFn === "number") {
    // Time-based yielding
    let remaining = secondsOrFn * 1000;
    let last = Date.now();
    while (remaining > 0) {
      yield;
      const now = Date.now();
      remaining -= now - last;
      last = now;
    }
  } else {
    // Yield until callback doesn't throw
    const fn = secondsOrFn;
    const { timeout = 50 } = options;
    const timeoutMs = timeout * 1000;
    const start = Date.now();

    while (true) {
      try {
        return fn();
      } catch (err) {
        if (Date.now() - start > timeoutMs) throw err;
      }
      yield;
    }
  }
}
