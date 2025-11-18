import defaultPackedMap from "@/shared/maps/revo.json" with { type: "json" };

import {
  buildLoadedMap,
  type LoadedMap,
  type PackedMap,
} from "@/shared/map.ts";
import { getMapMeta, MAPS } from "@/shared/maps/manifest.ts";
import { getCustomMapForLobby } from "./actions/uploadCustomMap.ts";
import type { Lobby } from "./lobby.ts";

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
          `${base}/maps/${entry.file}.json`,
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
  if (typeof Deno === "undefined") {
    throw new Error("Packed maps can only be loaded on the server");
  }

  const url = new URL(`../shared/maps/${meta.file}.json`, import.meta.url);
  const text = Deno.readTextFileSync(url);
  const packed = JSON.parse(text) as PackedMap;
  packedCache.set(map, packed);
  return packed;
};

export const createServerMap = (
  map: string,
  lobby?: Lobby,
): LoadedMap => {
  if (map.startsWith("local:") && lobby) {
    const customMap = getCustomMapForLobby(lobby, map);
    if (!customMap) throw new Error(`Custom map "${map}" not found in lobby`);
    const localId = map.replace("local:", "");
    return buildLoadedMap(map, customMap, { name: localId });
  }

  const packed = readPackedMap(map);
  const meta = getMapMeta(map);
  return buildLoadedMap(map, packed, { name: meta?.name });
};
