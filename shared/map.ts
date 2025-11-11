import type { App } from "@verit/ecs";

import defaultPackedMap from "./maps/revo.json" with { type: "json" };
import { addEntity, removeEntity } from "./api/entity.ts";
import { Entity } from "./types.ts";
import { deg2rad } from "./util/math.ts";
import { unpackMap2D } from "./util/2dPacking.ts";
import { prefabs } from "./data.ts";
import { unpackEntities } from "./util/entityPacking.ts";
import {
  getCliffHeight,
  getPathingMaskFromTerrainMasks,
} from "./pathing/terrainHelpers.ts";
import { appContext } from "./context.ts";
import { getMapMeta } from "./maps/manifest.ts";

export type PackedMap = typeof defaultPackedMap;

export type LoadedMap = {
  id: string;
  name: string;
  bounds: PackedMap["bounds"];
  center: NonNullable<PackedMap["center"]>;
  tiles: number[][];
  cliffs: (number | "r")[][];
  terrainPathingMap: number[][];
  terrainLayers: number[][];
  width: number;
  height: number;
  entities: ReturnType<typeof unpackEntities>;
};

type Listener = (map: LoadedMap) => void;

const mapsByApp = new WeakMap<App<Entity>, LoadedMap>();
const listenersByApp = new WeakMap<App<Entity>, Set<Listener>>();
const pendingListeners = new Set<Listener>();
const generatedEntitiesByApp = new WeakMap<
  App<Entity>,
  Map<Entity["type"] | "unknown", Set<Entity>>
>();

const getCurrentApp = (): App<Entity> | undefined => {
  try {
    return appContext.current;
  } catch {
    return undefined;
  }
};

const ensureApp = (): App<Entity> => {
  const app = getCurrentApp();
  if (!app) {
    throw new Error("Map access attempted without an active app context");
  }
  return app;
};

let fallbackMap: LoadedMap | undefined;
const getFallbackMap = (): LoadedMap =>
  fallbackMap ??
    (fallbackMap = buildLoadedMap("revo", defaultPackedMap));

const notifyMapChange = (app: App<Entity>, map: LoadedMap) => {
  const listeners = listenersByApp.get(app);
  if (!listeners?.size) return;
  appContext.with(app, () => {
    for (const listener of listeners) {
      try {
        listener(map);
      } catch (err) {
        console.error("Map listener failed", err);
      }
    }
  });
};

const getGeneratedSets = (app: App<Entity>) => {
  let map = generatedEntitiesByApp.get(app);
  if (!map) {
    map = new Map();
    generatedEntitiesByApp.set(app, map);
  }
  return map;
};

const trackGeneratedEntity = (
  entity: Entity,
  type: Entity["type"] | "unknown",
) => {
  const app = ensureApp();
  const sets = getGeneratedSets(app);
  let set = sets.get(type ?? "unknown");
  if (!set) {
    set = new Set();
    sets.set(type ?? "unknown", set);
  }
  set.add(entity);
};

export const buildLoadedMap = (
  map: string,
  packed: PackedMap,
  { name }: { name?: string } = {},
): LoadedMap => {
  const tiles = unpackMap2D(packed.terrain);
  const cliffs = unpackMap2D(packed.cliffs).map((row) =>
    row.map((value) => (value === 0 ? "r" : value - 1))
  );

  const bounds = packed.bounds
    ? {
      min: { x: packed.bounds.min.x, y: packed.bounds.min.y },
      max: { x: packed.bounds.max.x, y: packed.bounds.max.y },
    }
    : {
      min: { x: 0, y: 0 },
      max: { x: tiles[0]?.length ?? 0, y: tiles.length },
    };

  const center = { x: packed.center.x, y: packed.center.y };

  const rawPathing = getPathingMaskFromTerrainMasks(tiles, cliffs, bounds);
  const terrainPathingMap = rawPathing.toReversed();
  const terrainLayers = rawPathing.map((row, y) =>
    row.map((_, x) => Math.floor(getCliffHeight(x, y, cliffs)))
  ).toReversed();

  const mapName = name ?? getMapMeta(map)?.name ?? map;

  return {
    id: map,
    name: mapName,
    bounds,
    center,
    tiles,
    cliffs,
    terrainPathingMap,
    terrainLayers,
    height: tiles.length,
    width: tiles[0]?.length ?? 0,
    entities: unpackEntities(packed.entities),
  };
};

export const setMapForApp = (app: App<Entity>, map: LoadedMap) => {
  const current = mapsByApp.get(app);
  if (current && current.id === map.id) return;
  if (pendingListeners.size) {
    let listeners = listenersByApp.get(app);
    if (!listeners) {
      listeners = new Set();
      listenersByApp.set(app, listeners);
    }
    for (const listener of pendingListeners) {
      listeners.add(listener);
    }
    pendingListeners.clear();
  }
  mapsByApp.set(app, map);
  notifyMapChange(app, map);
};

export const setCurrentMap = (map: LoadedMap) => {
  const app = ensureApp();
  setMapForApp(app, map);
};

export const getMapForApp = (app: App<Entity>): LoadedMap => {
  const map = mapsByApp.get(app);
  if (!map) throw new Error("No map loaded for this app");
  return map;
};

export const getMap = (): LoadedMap => {
  const app = getCurrentApp();
  if (!app) return getFallbackMap();
  return getMapForApp(app);
};

export const onMapChange = (listener: Listener) => {
  const app = getCurrentApp();
  if (!app) {
    pendingListeners.add(listener);
    listener(getFallbackMap());
    return () => pendingListeners.delete(listener);
  }
  let listeners = listenersByApp.get(app);
  if (!listeners) {
    listeners = new Set();
    listenersByApp.set(app, listeners);
  }
  listeners.add(listener);
  const map = mapsByApp.get(app);
  if (map) listener(map);
  return () => listeners?.delete(listener);
};

export const getMapCenter = () => getMap().center;
export const getMapBounds = () => getMap().bounds;
export const getTiles = () => getMap().tiles;
export const getCliffs = () => getMap().cliffs;
export const getTerrainPathingMap = () => getMap().terrainPathingMap;
export const getTerrainLayers = () => getMap().terrainLayers;
export const getMapWidth = () => getMap().width;
export const getMapHeight = () => getMap().height;
export const getMapEntities = () => getMap().entities;

export const generateDoodads = (types?: Entity["type"][]) => {
  const map = getMap();
  for (const entityData of map.entities) {
    if (types?.length) {
      const prefabData = entityData.prefab
        ? prefabs[entityData.prefab]
        : undefined;
      const prefabType = prefabData?.type;
      const entityType = prefabType ?? entityData.type ?? "dynamic";
      if (!types.includes(entityType as Entity["type"])) continue;
    }

    const entity = addEntity({
      ...entityData,
      facing: typeof entityData.facing === "number"
        ? deg2rad(entityData.facing)
        : undefined,
    });

    trackGeneratedEntity(entity, entity.type ?? "unknown");
  }
};

export const clearDoodads = (types?: Entity["type"][]) => {
  const app = ensureApp();
  const generated = generatedEntitiesByApp.get(app);
  if (!generated) return;
  const keys = types?.length ? types : Array.from(generated.keys());
  for (const key of keys) {
    const set = generated.get(key ?? "unknown");
    if (!set) continue;
    for (const entity of set) {
      if (app.entities.has(entity)) removeEntity(entity);
    }
    generated.delete(key ?? "unknown");
  }
};

export const resetDoodads = (types?: Entity["type"][]) => {
  clearDoodads(types);
  generateDoodads(types);
};

// Provide a helper for consumers that still need a default map before lobby state arrives
export const buildDefaultMap = () => buildLoadedMap("revo", defaultPackedMap);
