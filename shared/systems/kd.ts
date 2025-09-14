import { Point } from "@/shared/pathing/math.ts";
import { Entity } from "@/shared/types.ts";
import { KdTree } from "@/shared/util/KDTree.ts";
import { addSystem, appContext } from "@/shared/context.ts";
import { App } from "@verit/ecs";

export const dataMap = new WeakMap<
  App<Entity>,
  {
    entityToPointMap: Map<Entity, Point>;
    pointToEntityMap: Map<Point, Entity>;
    kd: KdTree;
  }
>();

export const getEntitiesInRect = (
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
): Entity[] => {
  const data = dataMap.get(appContext.current);
  if (!data) throw new Error("Expected kd system to have initialized data");
  const points = data.kd.rangeSearchRect(minX, minY, maxX, maxY);
  return points.map((p) => {
    const entity = data.pointToEntityMap.get(p);
    if (!entity) {
      console.warn(`Expected point ${JSON.stringify(p)} to map to an entity`);
    }
    return entity;
  }).filter((v): v is Entity => !!v);
};

export const getEntitiesInRange = (
  x: number,
  y: number,
  radius: number,
): Entity[] => {
  const data = dataMap.get(appContext.current);
  if (!data) throw new Error("Expected kd system to have initialized data");
  const points = data.kd.rangeSearchCircle(x, y, radius);
  return points.map((p) => {
    const entity = data.pointToEntityMap.get(p);
    if (!entity) {
      console.warn(`Expected point ${JSON.stringify(p)} to map to an entity`);
    }
    return entity;
  }).filter((v): v is Entity => !!v);
};

addSystem((app) => {
  const entityToPointMap = new Map<Entity, Point>();
  const pointToEntityMap = new Map<Point, Entity>();
  const kd = new KdTree();
  dataMap.set(app, { entityToPointMap, pointToEntityMap, kd });

  return {
    props: ["position"],
    onAdd: (e) => {
      kd.add(e.position);
      entityToPointMap.set(e, e.position);
      pointToEntityMap.set(e.position, e);
    },
    onChange: (e) => {
      const prev = entityToPointMap.get(e);
      if (prev) {
        kd.replace(prev, e.position);
        pointToEntityMap.delete(prev);
      } else {
        kd.add(e.position);
      }
      entityToPointMap.set(e, e.position);
      pointToEntityMap.set(e.position, e);
    },
    onRemove: (e) => {
      const prev = entityToPointMap.get(e);
      if (!prev) return;
      kd.delete(prev);
      entityToPointMap.delete(e);
      pointToEntityMap.delete(prev);
    },
  };
});
