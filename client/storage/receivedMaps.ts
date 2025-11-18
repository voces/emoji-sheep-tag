import { type PackedMap } from "@/shared/map.ts";

// In-memory storage for custom maps received from the server during the session
const receivedMaps = new Map<string, PackedMap>();

export const storeReceivedMap = (mapId: string, mapData: PackedMap): void => {
  receivedMaps.set(mapId, mapData);
};

export const getReceivedMap = (mapId: string): PackedMap | undefined => {
  return receivedMaps.get(mapId);
};

export const clearReceivedMaps = (): void => {
  receivedMaps.clear();
};
