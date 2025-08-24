import { Point } from "@/shared/pathing/math.ts";
import { Entity, SystemEntity } from "@/shared/types.ts";
import { KdTree } from "../util/KDTree.ts";
import { addSystem, appContext } from "@/shared/context.ts";
import { App } from "jsr:@verit/ecs";

export const dataMap = new WeakMap<
  App<Entity>,
  {
    entityToPointMap: Map<SystemEntity<"position">, Point>;
    pointToEntityMap: Map<Point, SystemEntity<"position">>;
    kd: KdTree;
  }
>();

export const getEntitiesInRange = (x: number, y: number, radius: number) => {
  const data = dataMap.get(appContext.current);
  if (!data) throw new Error("Expected kd system to have initialized data");
  const points = data.kd.rangeSearchCircle(x, y, radius);
  return points.map((p) => {
    const entity = data.pointToEntityMap.get(p);
    // This may happen due to synchronous removal + call?
    if (!entity) {
      console.warn(
        `Expected point ${JSON.stringify(p)} to map to an entity`,
      );
    }
    return entity;
  }).filter(<T>(v: T | undefined): v is T => !!v);
};

addSystem((app) => {
  const entityToPointMap = new Map<SystemEntity<"position">, Point>();
  const pointToEntityMap = new Map<Point, SystemEntity<"position">>();
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
      } else kd.add(e.position);
      entityToPointMap.set(e, e.position);
      pointToEntityMap.set(e.position, e);
    },
    onRemove: (e) => {
      const prev = entityToPointMap.get(e as SystemEntity<"position">);
      if (!prev) return;
      kd.delete(prev);
      entityToPointMap.delete(e as SystemEntity<"position">);
      pointToEntityMap.delete(prev);
    },
  };
});
