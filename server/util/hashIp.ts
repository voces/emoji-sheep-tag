// Salt so the published hashes can't be matched against a plain hash of an IP.
// Kept constant so a player's client id is stable across server restarts.
const SALT = "emoji-sheep-tag/client-id/v1";

/**
 * Derives a stable, opaque identifier from a client IP. Published to clients so
 * they can ignore a player's chat across reconnects (and sessions) without ever
 * seeing the raw IP. Uses cyrb53 — deterministic and dependency-free.
 */
export const hashIp = (ip: string): string => {
  const input = SALT + ip;
  let h1 = 0xdeadbeef ^ SALT.length;
  let h2 = 0x41c6ce57 ^ SALT.length;
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(
    14,
    "0",
  );
};
