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

/**
 * Whether the ground itself is in the way, rather than another unit.
 *
 * Terrain and structures are the same on both sides and are not predicted, so a
 * unit put inside one is a mistake that will not come out in the wash. Other
 * units are a moving target the client only knows to within a tick of where the
 * server has them, and the server's own rules about which of them may be walked
 * through are not reproduced here. Refusing to predict past one of those is
 * what leaves a unit squeezing by an enemy stepping at the update rate rather
 * than the frame rate — far worse to look at than the sliver of overlap that
 * predicting through it costs, which the next update takes back.
 */
export const blockedByGeometry = (
  entity: Entity,
  target?: { x: number; y: number },
) => {
  if (!isPathingEntity(entity)) return false;
  if (pathingMap.pathable(entity, target?.x, target?.y)) return false;

  // Terrain is not an entity, so nothing standing in the way means the ground
  // is what the entity is up against.
  const blockers = pathingMap.blockers(entity, target?.x, target?.y);
  return !blockers.length || blockers.some((b) => b.tilemap);
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
