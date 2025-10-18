import { App } from "@verit/ecs";
import { Entity } from "@/shared/types.ts";
import { PathingMap } from "@/shared/pathing/PathingMap.ts";
import { PathingEntity, TargetEntity } from "@/shared/pathing/types.ts";
import { lookup } from "./lookup.ts";
import { terrainLayers, terrainPathingMap } from "@/shared/map.ts";
import { isPathingEntity } from "@/shared/pathing/util.ts";
import { addSystem, appContext } from "@/shared/context.ts";

const pathingMaps = new WeakMap<App<Entity>, PathingMap>();

export const pathingMap = () => {
  const pathingMap = pathingMaps.get(appContext.current);
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

    try {
      const path = pathingMap().path(
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
      ).slice(1);

      if (
        path.at(-1)?.x === entity.position.x &&
        path.at(-1)?.y === entity.position.y
      ) path.pop();

      return path;
    } catch {
      return [];
    }
  }

  const path = pathingMap().path(
    entity,
    target,
    { distanceFromTarget, removeMovingEntities },
  ).slice(1);

  if (
    path.at(-1)?.x === entity.position.x &&
    path.at(-1)?.y === entity.position.y
  ) path.pop();

  return path;
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

addSystem((app) => {
  const pathingMap = new PathingMap({
    resolution: 4,
    tileResolution: 2,
    pathing: terrainPathingMap,
    layers: terrainLayers,
  });

  pathingMaps.set(app, pathingMap);

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

const tilemapsEqual = (
  a: Entity["tilemap"],
  b: Entity["tilemap"],
): boolean => {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.top === b.top &&
    a.left === b.left &&
    a.height === b.height &&
    a.width === b.width &&
    a.map.length === b.map.length &&
    a.map.every((v, i) => v === b.map[i]);
};

addSystem(() => {
  const tilemaps = new WeakMap<Entity, Entity["tilemap"]>();

  return {
    props: ["tilemap"],
    onAdd: (e) => {
      tilemaps.set(e, e.tilemap);
    },
    onChange: (e) => {
      if (!e.position) return;
      const prev = tilemaps.get(e);
      if (tilemapsEqual(prev, e.tilemap)) return;
      tilemaps.set(e, e.tilemap);
      pathingMap().removeEntity(e);
      pathingMap().addEntity(e as PathingEntity);
    },
  };
});
