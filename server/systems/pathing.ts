import { App } from "jsr:@verit/ecs";
import { Entity } from "../../shared/types.ts";
import { PathingMap } from "../../shared/pathing/PathingMap.ts";
import { currentApp } from "../contexts.ts";
import { PathingEntity, TargetEntity } from "../../shared/pathing/types.ts";
import { lookup } from "./lookup.ts";
import { tiles } from "../../shared/map.ts";
import { isPathingEntity } from "../../shared/pathing/util.ts";
import { addSystem } from "../ecs.ts";

const pathingMaps = new WeakMap<App<Entity>, PathingMap>();

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
  { distanceFromTarget, mode, removeMovingEntities }: {
    distanceFromTarget?: number;
    mode?: "attack";
    removeMovingEntities?: boolean;
  } = {},
) => {
  if (!isPathingEntity(entity)) return [];
  if (!pathingMap().pathable(entity)) return [];
  if (typeof target === "string") {
    const targetEntity = lookup(target);
    if (!targetEntity?.position) return [];
    return pathingMap().path(
      entity,
      targetEntity as TargetEntity,
      {
        distanceFromTarget: (mode === "attack"
          ? Math.max(
            0,
            (distanceFromTarget ?? entity.attack?.range ?? 0) -
              (targetEntity.order?.type === "walk"
                ? (targetEntity.movementSpeed ?? 0) * 0.2
                : 0),
          )
          : distanceFromTarget),
        removeMovingEntities,
      },
    );
  }
  return pathingMap().path(
    entity,
    target,
    { distanceFromTarget, removeMovingEntities },
  );
};

export const pathable = (
  entity: Entity,
  target?: { x: number; y: number },
) => {
  if (!isPathingEntity(entity)) return false;
  return pathingMap().pathable(entity, target?.x, target?.y);
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

export const updatePathing = (entity: Entity, max = Infinity) => {
  const p = pathingMap();
  if (!isPathingEntity(entity)) return;
  if (p.pathable(entity)) return;
  const nearest = p.withoutEntity(
    entity,
    () => p.nearestSpiralPathing(entity.position.x, entity.position.y, entity),
  );
  if (
    (nearest.x !== entity.position.x || nearest.y !== entity.position.y) &&
    ((nearest.x - entity.position.x) ** 2 +
            (nearest.y - entity.position.y) ** 2) ** 0.5 < max
  ) entity.position = nearest;
};

addSystem((game) => {
  const pathingMap = new PathingMap({
    resolution: 4,
    pathing: tiles.reverse(),
  });

  pathingMaps.set(game, pathingMap);

  return {
    props: ["position", "radius"],
    onAdd: (e) => {
      pathingMap.addEntity(e);
      if (e.pathing) updatePathing(e);
    },
    onChange: (e) => {
      pathingMap.updateEntity(e);
      if (e.pathing) updatePathing(e);
    },
    onRemove: (e) => pathingMap.removeEntity(e as PathingEntity),
  };
});
