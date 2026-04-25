import {
  buildPushPayload,
  type PushSubscription,
  type VapidKeys,
} from "@block65/webcrypto-web-push";
import {
  listSubscriptions,
  removeSubscription,
  type StoredPushSubscription,
} from "./storage.ts";

const DEFAULT_SUBJECT = "mailto:status@example.com";
const SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? DEFAULT_SUBJECT;
const DEV_KEY_FILE = ".vapid.json";

if (SUBJECT === DEFAULT_SUBJECT) {
  console.warn(
    `[status] VAPID_SUBJECT not set; using placeholder ${DEFAULT_SUBJECT}. Push services use this to contact you about abuse — set it to mailto:you@yourdomain.com.`,
  );
}

type StoredKeys = { publicKey: string; privateKey: string };

let cached: StoredKeys | undefined;

const b64urlEncode = (bytes: Uint8Array) => {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

const b64urlDecode = (s: string) => {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};

const generateVapidKeys = async (): Promise<StoredKeys> => {
  const pair = await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"],
  );
  const jwk = await crypto.subtle.exportKey("jwk", pair.privateKey);
  if (!jwk.x || !jwk.y || !jwk.d) throw new Error("Missing JWK fields");
  const x = b64urlDecode(jwk.x);
  const y = b64urlDecode(jwk.y);
  const uncompressed = new Uint8Array(65);
  uncompressed[0] = 0x04;
  uncompressed.set(x, 1);
  uncompressed.set(y, 33);
  return {
    publicKey: b64urlEncode(uncompressed),
    privateKey: jwk.d,
  };
};

const loadOrGenerateKeys = async (): Promise<StoredKeys> => {
  const pub = Deno.env.get("VAPID_PUBLIC_KEY");
  const priv = Deno.env.get("VAPID_PRIVATE_KEY");
  if (pub && priv) return { publicKey: pub, privateKey: priv };

  try {
    return JSON.parse(await Deno.readTextFile(DEV_KEY_FILE));
  } catch {
    const generated = await generateVapidKeys();
    await Deno.writeTextFile(DEV_KEY_FILE, JSON.stringify(generated, null, 2));
    console.log(
      `[status] Generated VAPID keys at ${DEV_KEY_FILE}. To override, set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY env vars.`,
    );
    return generated;
  }
};

const ensureKeys = async () => {
  if (!cached) cached = await loadOrGenerateKeys();
  return cached;
};

export const getVapidPublicKey = async () => (await ensureKeys()).publicKey;

const toVapid = (k: StoredKeys): VapidKeys => ({
  subject: SUBJECT,
  publicKey: k.publicKey,
  privateKey: k.privateKey,
});

const toPushSubscription = (s: StoredPushSubscription): PushSubscription => ({
  endpoint: s.endpoint,
  expirationTime: null,
  keys: s.keys,
});

const sendOne = async (
  sub: StoredPushSubscription,
  payload: unknown,
  vapid: VapidKeys,
) => {
  try {
    const built = await buildPushPayload(
      {
        data: payload as Parameters<typeof buildPushPayload>[0]["data"],
        options: { ttl: 60 },
      },
      toPushSubscription(sub),
      vapid,
    );
    const res = await fetch(sub.endpoint, {
      method: built.method,
      headers: built.headers,
      body: built.body as BodyInit,
    });
    if (res.status === 404 || res.status === 410) {
      await removeSubscription(sub.endpoint);
    } else if (!res.ok) {
      console.error(
        `[status] Push delivery failed: ${res.status} ${await res.text()}`,
      );
    }
  } catch (err) {
    console.error("[status] Push delivery error:", err);
  }
};

export const sendPushToAll = async (payload: unknown) => {
  const subs = await listSubscriptions();
  if (subs.length === 0) return;
  const vapid = toVapid(await ensureKeys());
  await Promise.allSettled(subs.map((sub) => sendOne(sub, payload, vapid)));
};
