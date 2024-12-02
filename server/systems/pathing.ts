import { App } from "jsr:@verit/ecs";
import { Entity } from "../../shared/types.ts";
import { PathingMap } from "../../shared/pathing/PathingMap.ts";
import { currentApp } from "../contexts.ts";
import { PathingEntity, TargetEntity } from "../../shared/pathing/types.ts";
import { lookup } from "./lookup.ts";
import { tiles } from "../../shared/map.ts";

const pathingMaps = new WeakMap<App<Entity>, PathingMap>();

export const isPathingEntity = (entity: Entity): entity is PathingEntity =>
  !!entity.position && typeof entity.radius === "number" && !entity.isDoodad;

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
  target: string | { x: number; y: number },
  { mode, removeMovingEntities }: {
    mode?: "attack";
    removeMovingEntities?: boolean;
  } = {},
) => {
  if (!isPathingEntity(entity)) return [];
  if (typeof target === "string") {
    const targetEntity = lookup(target);
    if (!targetEntity?.position) return [];
    return pathingMap().path(
      entity,
      targetEntity as TargetEntity,
      {
        distance: mode === "attack"
          ? Math.max(
            0,
            (entity.attack?.range ?? 0) -
              (targetEntity.isMoving
                ? (targetEntity.movementSpeed ?? 0) * 0.2
                : 0),
          )
          : undefined,
        removeMovingEntities,
      },
    );
  }
  return pathingMap().path(
    entity,
    target,
    undefined,
  );
};

export const pathable = (
  entity: Entity,
  target?: { x: number; y: number },
) => {
  if (!isPathingEntity(entity)) return false;
  const pm = pathingMap();
  // TODO: withoutEntity required?
  return pm.withoutEntity(
    entity,
    () => pm.pathable(entity, target?.x, target?.y),
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

export const updatePathing = (entity: Entity) => {
  const p = pathingMap();
  if (!isPathingEntity(entity)) return;
  if (p.pathable(entity)) return;
  const nearest = p.withoutEntity(
    entity,
    () => p.nearestSpiralPathing(entity.position.x, entity.position.y, entity),
  );
  if (nearest.x !== entity.position.x || nearest.y !== entity.position.y) {
    entity.position = nearest;
  }
};

export const addPathingSystem = (app: App<Entity>) => {
  const pathingMap = new PathingMap({
    resolution: 4,
    pathing: tiles.reverse(),
  });

  pathingMaps.set(app, pathingMap);

  app.addSystem({
    props: ["position", "radius"],
    onAdd: (e) => {
      pathingMap.addEntity(e);
      updatePathing(e);
    },
    onChange: (e) => {
      pathingMap.updateEntity(e);
      updatePathing(e);
    },
    onRemove: (e) => pathingMap.removeEntity(e as any),
  });
};
