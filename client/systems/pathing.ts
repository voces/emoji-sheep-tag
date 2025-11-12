import { Entity } from "../ecs.ts";
import { PathingMap } from "@/shared/pathing/PathingMap.ts";
import {
  getTerrainLayers,
  getTerrainPathingMap,
  onMapChange,
} from "@/shared/map.ts";
import { isPathingEntity } from "@/shared/pathing/util.ts";
import { PathingEntity } from "@/shared/pathing/types.ts";
import { addSystem } from "@/shared/context.ts";

const createPathingMap = () =>
  new PathingMap({
    resolution: 4,
    tileResolution: 2,
    pathing: getTerrainPathingMap(),
    layers: getTerrainLayers(),
  });

export let pathingMap = createPathingMap();

export const pathable = (
  entity: Entity,
  target?: { x: number; y: number },
) => {
  if (!isPathingEntity(entity)) return true;
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

onMapChange(() => {
  pathingMap = createPathingMap();
});
