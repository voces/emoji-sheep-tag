const PAGE_LOAD_TOTAL = ["status", "pageLoads", "total"] as const;
const PAGE_LOAD_BUCKET = ["status", "pageLoads", "bucket"] as const;
const SUB_PREFIX = ["status", "subs"] as const;
const ROUND_PREFIX = ["status", "rounds"] as const;

const BUCKET_MS = 5 * 60 * 1000;
const BUCKET_TTL_MS = 31 * 24 * 60 * 60 * 1000;

const WINDOW_MS = {
  "5m": 5 * 60 * 1000,
  "1h": 60 * 60 * 1000,
  "1d": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
} as const;

export type PageLoadStats = {
  total: number;
  windows: Record<keyof typeof WINDOW_MS, number>;
};

const ENABLED = Deno.env.get("STATUS_KV_DISABLED") !== "1";

let kvPromise: Promise<Deno.Kv> | undefined;
const getKv = () => kvPromise ??= Deno.openKv(Deno.env.get("KV_PATH"));

export const incrementPageLoads = async () => {
  if (!ENABLED) return;
  const kv = await getKv();
  const bucket = Math.floor(Date.now() / BUCKET_MS) * BUCKET_MS;
  const bucketKey = [...PAGE_LOAD_BUCKET, bucket];
  const expireIn = Math.max(1000, bucket + BUCKET_TTL_MS - Date.now());

  for (let attempt = 0; attempt < 5; attempt++) {
    const current = await kv.get<Deno.KvU64>(bucketKey);
    const next = new Deno.KvU64((current.value?.value ?? 0n) + 1n);
    const result = await kv.atomic()
      .check(current)
      .set(bucketKey, next, { expireIn })
      .sum([...PAGE_LOAD_TOTAL], 1n)
      .commit();
    if (result.ok) return;
  }
  console.error("[status] incrementPageLoads: CAS failed after 5 attempts");
};

export const getPageLoadStats = async (): Promise<PageLoadStats> => {
  if (!ENABLED) {
    return {
      total: 0,
      windows: { "5m": 0, "1h": 0, "1d": 0, "7d": 0, "30d": 0 },
    };
  }
  const kv = await getKv();
  const totalEntry = await kv.get<Deno.KvU64>([...PAGE_LOAD_TOTAL]);
  const total = Number(totalEntry.value?.value ?? 0n);

  const now = Date.now();
  const windows: Record<keyof typeof WINDOW_MS, number> = {
    "5m": 0,
    "1h": 0,
    "1d": 0,
    "7d": 0,
    "30d": 0,
  };

  for await (
    const entry of kv.list<Deno.KvU64>({
      start: [...PAGE_LOAD_BUCKET, now - WINDOW_MS["30d"]],
      end: [...PAGE_LOAD_BUCKET, now + 1],
    })
  ) {
    const bucket = entry.key[entry.key.length - 1] as number;
    const count = Number(entry.value.value);
    const age = now - bucket;
    for (const [name, ms] of Object.entries(WINDOW_MS)) {
      if (age <= ms) windows[name as keyof typeof WINDOW_MS] += count;
    }
  }
  return { total, windows };
};

export type StoredPushSubscription = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  createdAt: number;
};

export const addSubscription = async (sub: StoredPushSubscription) => {
  if (!ENABLED) return;
  const kv = await getKv();
  await kv.set([...SUB_PREFIX, sub.endpoint], sub);
};

export const removeSubscription = async (endpoint: string) => {
  if (!ENABLED) return;
  const kv = await getKv();
  await kv.delete([...SUB_PREFIX, endpoint]);
};

export const listSubscriptions = async () => {
  if (!ENABLED) return [];
  const kv = await getKv();
  const out: StoredPushSubscription[] = [];
  for await (
    const entry of kv.list<StoredPushSubscription>({ prefix: [...SUB_PREFIX] })
  ) out.push(entry.value);
  return out;
};

export type RoundRecord = {
  lobby: string;
  mode: string;
  sheep: string[];
  wolves: string[];
  durationMs: number;
  endedAt: number;
};

export const addRoundRecord = async (record: RoundRecord) => {
  if (!ENABLED) return;
  const kv = await getKv();
  await kv.set(
    [...ROUND_PREFIX, -record.endedAt, crypto.randomUUID()],
    record,
    { expireIn: 1000 * 60 * 60 * 24 * 30 },
  );
};

export const recentRounds = async (limit = 20) => {
  if (!ENABLED) return [];
  const kv = await getKv();
  const out: RoundRecord[] = [];
  for await (
    const entry of kv.list<RoundRecord>({ prefix: [...ROUND_PREFIX] }, {
      limit,
    })
  ) out.push(entry.value);
  return out;
};
