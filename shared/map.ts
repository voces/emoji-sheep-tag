import revo from "./maps/revo.json" with { type: "json" };
import { addEntity } from "./api/entity.ts";
import { deg2rad } from "./util/math.ts";
import { unpackMap2D } from "./util/2dPacking.ts";
import { prefabs, tiles as tilesDef } from "@/shared/data.ts";
import { unpackEntities } from "./util/entityPacking.ts";
import { Entity } from "./types.ts";

export const tiles = unpackMap2D(revo.terrain).map((r) =>
  r.map((i) => tilesDef[i].pathing)
);

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
