import { DatabaseSync } from "node:sqlite";
import { env } from "../platform/env.ts";

const BUCKET_MS = 5 * 60 * 1000;
const RETENTION_MS = 31 * 24 * 60 * 60 * 1000;
const ROUND_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

const WINDOW_MS = {
  "5m": 5 * 60 * 1000,
  "1h": 60 * 60 * 1000,
  "1d": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
} as const;

type Window = keyof typeof WINDOW_MS;

export type PageLoadStats = {
  total: number;
  windows: Record<Window, number>;
};

export type StoredPushSubscription = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  createdAt: number;
};

export type RoundRecord = {
  lobby: string;
  mode: string;
  sheep: string[];
  wolves: string[];
  durationMs: number;
  endedAt: number;
};

const emptyWindows = (): Record<Window, number> => ({
  "5m": 0,
  "1h": 0,
  "1d": 0,
  "7d": 0,
  "30d": 0,
});

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS counters (
    name TEXT PRIMARY KEY,
    value INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS page_load_buckets (
    bucket INTEGER PRIMARY KEY,
    count INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS push_subscriptions (
    endpoint TEXT PRIMARY KEY,
    data TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS rounds (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ended_at INTEGER NOT NULL,
    data TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS rounds_ended_at ON rounds (ended_at);
`;

/** Status page data in a SQLite database at `path` (`:memory:` for none). */
export const openStatusStore = (path: string) => {
  const db = new DatabaseSync(path);
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec(SCHEMA);

  const bumpTotal = db.prepare(
    `INSERT INTO counters (name, value) VALUES ('pageLoads', 1)
     ON CONFLICT (name) DO UPDATE SET value = value + 1`,
  );
  const bumpBucket = db.prepare(
    `INSERT INTO page_load_buckets (bucket, count) VALUES (?, 1)
     ON CONFLICT (bucket) DO UPDATE SET count = count + 1`,
  );
  const pruneBuckets = db.prepare(
    "DELETE FROM page_load_buckets WHERE bucket < ?",
  );
  const readTotal = db.prepare(
    "SELECT value FROM counters WHERE name = 'pageLoads'",
  );
  const readBuckets = db.prepare(
    "SELECT bucket, count FROM page_load_buckets WHERE bucket >= ? AND bucket <= ?",
  );
  const upsertSubscription = db.prepare(
    `INSERT INTO push_subscriptions (endpoint, data) VALUES (?, ?)
     ON CONFLICT (endpoint) DO UPDATE SET data = excluded.data`,
  );
  const deleteSubscription = db.prepare(
    "DELETE FROM push_subscriptions WHERE endpoint = ?",
  );
  const readSubscriptions = db.prepare(
    "SELECT data FROM push_subscriptions ORDER BY endpoint",
  );
  const insertRound = db.prepare(
    "INSERT INTO rounds (ended_at, data) VALUES (?, ?)",
  );
  const pruneRounds = db.prepare("DELETE FROM rounds WHERE ended_at < ?");
  const readRounds = db.prepare(
    "SELECT data FROM rounds WHERE ended_at >= ? ORDER BY ended_at DESC, id DESC LIMIT ?",
  );

  const parseRows = <T>(rows: Record<string, unknown>[]): T[] =>
    rows.map((row) => JSON.parse(String(row.data)));

  const incrementPageLoads = (now = Date.now()) => {
    db.exec("BEGIN");
    try {
      bumpTotal.run();
      bumpBucket.run(Math.floor(now / BUCKET_MS) * BUCKET_MS);
      pruneBuckets.run(now - RETENTION_MS);
      db.exec("COMMIT");
    } catch (err) {
      db.exec("ROLLBACK");
      throw err;
    }
  };

  const getPageLoadStats = (now = Date.now()): PageLoadStats => {
    const windows = emptyWindows();
    for (const row of readBuckets.all(now - WINDOW_MS["30d"], now)) {
      const age = now - Number(row.bucket);
      for (const [name, ms] of Object.entries(WINDOW_MS)) {
        if (age <= ms) windows[name as Window] += Number(row.count);
      }
    }
    return { total: Number(readTotal.get()?.value ?? 0), windows };
  };

  const addSubscription = (sub: StoredPushSubscription) =>
    void upsertSubscription.run(sub.endpoint, JSON.stringify(sub));

  const removeSubscription = (endpoint: string) =>
    void deleteSubscription.run(endpoint);

  const listSubscriptions = () =>
    parseRows<StoredPushSubscription>(readSubscriptions.all());

  const addRoundRecord = (record: RoundRecord, now = Date.now()) => {
    insertRound.run(record.endedAt, JSON.stringify(record));
    pruneRounds.run(now - ROUND_RETENTION_MS);
  };

  const recentRounds = (limit = 20, now = Date.now()) =>
    parseRows<RoundRecord>(readRounds.all(now - ROUND_RETENTION_MS, limit));

  return {
    incrementPageLoads,
    getPageLoadStats,
    addSubscription,
    removeSubscription,
    listSubscriptions,
    addRoundRecord,
    recentRounds,
  };
};

type StatusStore = ReturnType<typeof openStatusStore>;

const ENABLED = env("STATUS_DB_DISABLED") !== "1";

let store: StatusStore | undefined;
const getStore = () =>
  store ??= openStatusStore(env("STATUS_DB_PATH") ?? "status.db");

export const incrementPageLoads = () => {
  if (ENABLED) getStore().incrementPageLoads();
};

export const getPageLoadStats = (): PageLoadStats =>
  ENABLED
    ? getStore().getPageLoadStats()
    : { total: 0, windows: emptyWindows() };

export const addSubscription = (sub: StoredPushSubscription) => {
  if (ENABLED) getStore().addSubscription(sub);
};

export const removeSubscription = (endpoint: string) => {
  if (ENABLED) getStore().removeSubscription(endpoint);
};

export const listSubscriptions = () =>
  ENABLED ? getStore().listSubscriptions() : [];

export const addRoundRecord = (record: RoundRecord) => {
  if (ENABLED) getStore().addRoundRecord(record);
};

export const recentRounds = (limit = 20) =>
  ENABLED ? getStore().recentRounds(limit) : [];
