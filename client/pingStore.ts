const STALE_MS = 5_000;

export type PingKey = "primary" | "shard-game" | { shard: string };

const keyOf = (k: PingKey): string =>
  typeof k === "string" ? k : `shard:${k.shard}`;

type PingEntry = { ms: number; recordedAt: number };
const pings = new Map<string, PingEntry>();

export const recordPing = (key: PingKey, ms: number) => {
  pings.set(keyOf(key), { ms, recordedAt: performance.now() });
};

export const getPing = (key: PingKey): number | undefined => {
  const entry = pings.get(keyOf(key));
  if (!entry) return undefined;
  if (performance.now() - entry.recordedAt > STALE_MS) return undefined;
  return entry.ms;
};

export const clearPing = (key: PingKey) => {
  pings.delete(keyOf(key));
};
