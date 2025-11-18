import defaultPackedMap from "@/shared/maps/revo.json" with { type: "json" };

import {
  buildLoadedMap,
  type LoadedMap,
  type PackedMap,
} from "@/shared/map.ts";
import { getMapMeta } from "@/shared/maps/manifest.ts";
import { getLocalMap } from "./storage/localMaps.ts";
import { getReceivedMap } from "./storage/receivedMaps.ts";

const packedCache = new Map<string, PackedMap>([
  ["revo", defaultPackedMap],
]);
const inflightFetches = new Map<string, Promise<PackedMap>>();

const fetchPackedMap = (map: string): Promise<PackedMap> => {
  if (packedCache.has(map)) {
    return Promise.resolve(packedCache.get(map)!);
  }

  const meta = getMapMeta(map);
  if (!meta) return Promise.reject(new Error(`Unknown map id "${map}"`));

  let promise = inflightFetches.get(map);
  if (promise) return promise;

  promise = fetch(`/maps/${meta.file}.json`).then((res) => {
    if (!res.ok) throw new Error(`Failed to load map ${map}`);
    return res.json() as Promise<PackedMap>;
  }).then((packed) => {
    packedCache.set(map, packed);
    inflightFetches.delete(map);
    return packed;
  }).catch((err) => {
    inflightFetches.delete(map);
    throw err;
  });

  inflightFetches.set(map, promise);
  return promise;
};

const fetchLocalPackedMap = async (
  mapId: string,
): Promise<{ packed: PackedMap; name: string }> => {
  // First check if we received this map from the server
  const receivedMap = getReceivedMap(`local:${mapId}`);
  if (receivedMap) {
    return { packed: receivedMap, name: mapId };
  }

  // Otherwise, load from local storage
  const entry = await getLocalMap(mapId);
  if (!entry) throw new Error(`Custom map "${mapId}" not found`);
  return { packed: entry.data, name: entry.name };
};

export const isLocalMap = (mapId: string): boolean =>
  mapId.startsWith("local:");

export const loadClientMap = async (map: string): Promise<LoadedMap> => {
  if (isLocalMap(map)) {
    const localId = map.replace("local:", "");
    const { packed, name } = await fetchLocalPackedMap(localId);
    return buildLoadedMap(map, packed, { name });
  }

  const packed = await fetchPackedMap(map);
  const meta = getMapMeta(map);
  return buildLoadedMap(map, packed, { name: meta?.name });
};
