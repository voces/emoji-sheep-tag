import { App } from "jsr:@verit/ecs";
import { Entity } from "../../shared/types.ts";
import { PathingMap } from "../../shared/pathing/PathingMap.ts";
import { currentApp } from "../contexts.ts";
import { PathingEntity } from "../../shared/pathing/types.ts";

const pathingMaps = new WeakMap<App<Entity>, PathingMap>();

export const isPathingEntity = (entity: Entity): entity is PathingEntity =>
  !!entity.position && typeof entity.radius === "number";

export const pathingMap = () => {
  const app = currentApp();
  const pathingMap = pathingMaps.get(app);
  if (!pathingMap) throw new Error("Expected there to be a pathingmap");
  return pathingMap;
};

export const withPathingMap = <T>(fn: (pathingMap: PathingMap) => T) =>
  fn(pathingMap());

export const calcPath = (
  entity: Entity,
  target: { x: number; y: number },
) => {
  if (!isPathingEntity(entity)) return [];
  return pathingMap().path(entity, target);
};

export const pathable = (
  entity: Entity,
  target: { x: number; y: number },
) => {
  if (!isPathingEntity(entity)) return false;
  const pm = pathingMap();
  // TODO: withoutEntity required?
  return pm.withoutEntity(
    entity,
    () => pm.pathable(entity, target.x, target.y),
  );
};

export const nearestPathing = (
  entity: Entity,
  target: { x: number; y: number },
) => {
  if (!isPathingEntity(entity)) return target;
  const pm = pathingMap();
  // TODO: withoutEntity required?
  return pm.withoutEntity(
    entity,
    () => pm.nearestPathing(target.x, target.y, entity),
  );
};

export const addPathingSystem = (app: App<Entity>) => {
  const pathingMap = new PathingMap({
    resolution: 4,
    pathing: Array.from(
      { length: 50 },
      () => Array.from({ length: 50 }, () => 0),
    ),
  });

  pathingMaps.set(app, pathingMap);

  app.addSystem({
    props: ["position", "radius"],
    onAdd: (e) => pathingMap.addEntity(e),
    onChange: (e) => pathingMap.updateEntity(e),
    onRemove: (e) => pathingMap.removeEntity(e as any),
  });
};
