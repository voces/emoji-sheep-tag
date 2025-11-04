import { Entity } from "../ecs.ts";
import { PathingMap } from "@/shared/pathing/PathingMap.ts";
import { terrainLayers, terrainPathingMap } from "@/shared/map.ts";
import { isPathingEntity } from "@/shared/pathing/util.ts";
import { PathingEntity } from "@/shared/pathing/types.ts";
import { addSystem } from "@/shared/context.ts";

export const pathingMap = new PathingMap({
  resolution: 4,
  tileResolution: 2,
  pathing: terrainPathingMap,
  layers: terrainLayers,
});

export const pathable = (
  entity: Entity,
  target?: { x: number; y: number },
) => {
  if (!isPathingEntity(entity)) return false;
  return pathingMap.pathable(entity, target?.x, target?.y);
};

addSystem({
  props: ["position", "radius"],
  onAdd: (e) => e.type !== "cosmetic" && pathingMap.addEntity(e),
  onChange: (e) => e.type !== "cosmetic" && pathingMap.updateEntity(e),
  onRemove: (e) => e.type !== "cosmetic" && pathingMap.removeEntity(e),
});

addSystem({
  props: ["tilemap"],
  onChange: (e) => {
    if (!e.position) return;
    pathingMap.removeEntity(e);
    pathingMap.addEntity(e as PathingEntity);
  },
});
