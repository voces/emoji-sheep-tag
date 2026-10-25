import type { App } from "@verit/ecs";
import type { Entity } from "@/shared/types.ts";

/**
 * Key-sorted JSON, so the text depends on values alone and not on the order
 * properties were assigned in. Non-finite numbers become null, as in JSON.
 */
const canonical = (value: unknown): string => {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value) ?? "null";
  }
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${
    Object.keys(record)
      .filter((key) =>
        record[key] !== undefined && typeof record[key] !== "function"
      )
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonical(record[key])}`)
      .join(",")
  }}`;
};

/** cyrb53: a fast 53-bit string hash, returned as hex. */
const cyrb53 = (text: string) => {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16);
};

/** Every entity, ordered by id, in canonical form. */
export const canonicalState = (app: App<Entity>) =>
  Array.from(app.entities)
    .sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
    .map(canonical)
    .join("\n");

/**
 * A digest of every entity's state. Two runs of the same round agree on it at
 * a tick exactly when their entities agree.
 */
export const hashState = (app: App<Entity>) => cyrb53(canonicalState(app));
