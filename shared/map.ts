import revo from "./maps/revo.json" with { type: "json" };
import { addEntity } from "./api/entity.ts";
import { deg2rad } from "./util/math.ts";
import { unpackMap2D } from "./util/2dPacking.ts";
import { tiles as tilesDef } from "@/shared/data.ts";
import { unpackEntities } from "./util/entityPacking.ts";

export const tiles = unpackMap2D(revo.terrain).map((r) =>
  r.map((i) => tilesDef[i].pathing)
);

export const center = {
  x: tiles[0].length / 2,
  y: tiles.length / 2,
};

const entities = unpackEntities(revo.entities);

export const generateDoodads = () => {
  for (const entity of entities) {
    addEntity({
      ...entity,
      facing: typeof entity.facing === "number"
        ? deg2rad(entity.facing)
        : undefined,
    });
  }
};
