import defaultPackedMap from "@/shared/maps/revo.json" with { type: "json" };

import { type PackedMap } from "@/shared/map.ts";
import { getMapMeta, MAPS } from "@/shared/maps/manifest.ts";
import { getCustomMapForLobby } from "./actions/uploadCustomMap.ts";
import type { Lobby } from "./lobby.ts";
import { nodeFs } from "./platform/env.ts";

const packedCache = new Map<string, PackedMap>([
  ["revo", defaultPackedMap],
]);

if (typeof Deno === "undefined" && typeof globalThis.fetch === "function") {
  const base = (globalThis as { location?: { origin?: string } }).location
    ?.origin ?? globalThis.origin ?? "";
  const preload = async () => {
    for (const entry of MAPS) {
      if (packedCache.has(entry.id)) continue;
      try {
        const response = await globalThis.fetch(
          `${base}/maps/${entry.id}.json`,
        );
        if (!response.ok) {
          console.error(
            `Failed to load map "${entry.id}": ${response.status}`,
          );
          continue;
        }
        const packed = await response.json() as PackedMap;
        packedCache.set(entry.id, packed);
      } catch (err) {
        console.error(`Failed to fetch map "${entry.id}"`, err);
      }
    }
  };
  preload().catch((err) =>
    console.error("[maps] Failed to preload maps in worker", err)
  );
}

const readPackedMap = (map: string): PackedMap => {
  const cached = packedCache.get(map);
  if (cached) return cached;

  const meta = getMapMeta(map);
  if (!meta) throw new Error(`Unknown map id "${map}"`);
  const fs = nodeFs();
  if (!fs) throw new Error("Packed maps can only be loaded on the server");

  const url = new URL(`../shared/maps/${meta.id}.json`, import.meta.url);
  const text = fs.readFileSync(url, "utf8");
  const packed = JSON.parse(text) as PackedMap;
  packedCache.set(map, packed);
  return packed;
};

/** The packed source of a map id, and its display name. */
export const resolveServerMap = (
  map: string,
  lobby?: Lobby,
): { packed: PackedMap; name?: string } => {
  if (map.startsWith("local:") && lobby) {
    const customMap = getCustomMapForLobby(lobby, map);
    if (!customMap) throw new Error(`Custom map "${map}" not found in lobby`);
    return { packed: customMap, name: map.replace("local:", "") };
  }

  return { packed: readPackedMap(map), name: getMapMeta(map)?.name };
};
