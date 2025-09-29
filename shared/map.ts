import revo from "./maps/revo.json" with { type: "json" };
import { addEntity } from "./api/entity.ts";
import { deg2rad } from "./util/math.ts";
import { unpackMap2D } from "./util/2dPacking.ts";
import { prefabs } from "@/shared/data.ts";
import { unpackEntities } from "./util/entityPacking.ts";
import { Entity } from "./types.ts";
import {
  getCliffHeight,
  getPathingMaskFromTerrainMasks,
} from "./pathing/terrainHelpers.ts";

export const tiles = unpackMap2D(revo.terrain);

export const cliffs = unpackMap2D(revo.cliffs).map((r) =>
  r.map((v) => v === 0 ? "r" : v - 1)
);

const upsideDownTerrainPathingMap = getPathingMaskFromTerrainMasks(
  tiles,
  cliffs,
);
export const terrainPathingMap = upsideDownTerrainPathingMap.toReversed();

export const terrainLayers = upsideDownTerrainPathingMap.map((r, y) =>
  r.map((_, x) => Math.floor(getCliffHeight(x, y, cliffs)))
).toReversed();

export const height = tiles.length;
export const width = tiles[0].length;

export const center = revo.center;

const entities = unpackEntities(revo.entities);

export const generateDoodads = (types?: Entity["type"][]) => {
  for (const entity of entities) {
    if (types?.length) {
      const prefabData = entity.prefab ? prefabs[entity.prefab] : undefined;
      if (!prefabData?.type) {
        if (!types.includes("dynamic")) continue;
      } else if (!types.includes(prefabData.type)) continue;
    }

    addEntity({
      ...entity,
      facing: typeof entity.facing === "number"
        ? deg2rad(entity.facing)
        : undefined,
    });
  }
};
