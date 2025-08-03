import { SystemEntity } from "jsr:@verit/ecs";
import { Point } from "../../shared/pathing/math.ts";
import { Entity } from "../../shared/types.ts";
import { currentApp } from "../contexts.ts";
import { Game, addSystem } from "../ecs.ts";
import { KdTree } from "../util/KDTree.ts";

export const dataMap = new WeakMap<
  Game,
  {
    entityToPointMap: Map<SystemEntity<Entity, "position">, Point>;
    pointToEntityMap: Map<Point, SystemEntity<Entity, "position">>;
    kd: KdTree;
  }
>();

export const getEntitiesInRange = (x: number, y: number, radius: number) => {
  const data = dataMap.get(currentApp());
  if (!data) throw new Error("Expected kd system to have initialized data");
  const points = data.kd.rangeSearchCircle(x, y, radius);
  return points.map((p) => {
    const entity = data.pointToEntityMap.get(p);
    // This may happen due to synchronous removal + call?
    if (!entity) console.warn("Expected point to map to an entity");
    return entity;
  }).filter(<T>(v: T | undefined): v is T => !!v);
};

addSystem((game) => {
  const entityToPointMap = new Map<
    SystemEntity<Entity, "position">,
    Point
  >();
  const pointToEntityMap = new Map<
    Point,
    SystemEntity<Entity, "position">
  >();
  const kd = new KdTree();
  dataMap.set(game, { entityToPointMap, pointToEntityMap, kd });

  return {
    props: ["position"],
    onAdd: (e) => {
      kd.add(e.position);
      entityToPointMap.set(e, e.position);
      pointToEntityMap.set(e.position, e);
    },
    onChange: (e) => {
      const prev = entityToPointMap.get(e);
      if (prev) kd.replace(prev, e.position);
      else kd.add(e.position);
      entityToPointMap.set(e, e.position);
      pointToEntityMap.set(e.position, e);
    },
    onRemove: (e) => {
      const prev = entityToPointMap.get(e as SystemEntity<Entity, "position">);
      if (!prev) return;
      kd.delete(prev);
      entityToPointMap.delete(e as SystemEntity<Entity, "position">);
      pointToEntityMap.delete(prev);
    },
  };
});
