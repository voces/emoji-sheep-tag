import { app, Entity } from "../ecs.ts";
import { PathingMap } from "@/shared/pathing/PathingMap.ts";
import { tiles } from "@/shared/map.ts";
import { isPathingEntity } from "@/shared/pathing/util.ts";

export const pathingMap = new PathingMap({
  resolution: 4,
  pathing: tiles.reverse(),
});

export const pathable = (
  entity: Entity,
  target?: { x: number; y: number },
) => {
  if (!isPathingEntity(entity)) return false;
  return pathingMap.pathable(entity, target?.x, target?.y);
};

app.addSystem({
  props: ["position", "radius"],
  onAdd: (e) => !e.vertexColor && pathingMap.addEntity(e),
  onChange: (e) => !e.vertexColor && pathingMap.updateEntity(e),
  onRemove: (e) => pathingMap.removeEntity(e),
});
