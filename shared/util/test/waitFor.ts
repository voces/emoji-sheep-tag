import { delay } from "./delay.ts";

export async function waitFor<T>(
  condition: () => T | Promise<T>,
  { timeout = 2_000, interval = 50 }: { timeout?: number; interval?: number } =
    {},
): Promise<T> {
  const start = Date.now();
  let lastError: unknown = undefined;
  while (Date.now() - start < timeout) {
    try {
      return await condition();
    } catch (err) {
      // swallow and retry
      lastError = err;
    }
    await delay(interval);
  }

  const err = new Error(`waitFor: timed out after ${timeout} ms`, {
    cause: lastError,
  });
  Error.captureStackTrace(err, waitFor);

  throw lastError;
}
