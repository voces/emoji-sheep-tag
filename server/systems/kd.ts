import { SystemEntity } from "jsr:@verit/ecs";
import { Point } from "../../shared/pathing/math.ts";
import { Entity } from "../../shared/types.ts";
import { currentApp } from "../contexts.ts";
import { Game, onInit } from "../ecs.ts";
import { KdTree } from "../util/KDTree.ts";

const dataMap = new WeakMap<
  Game,
  {
    entityToPointMap: WeakMap<SystemEntity<Entity, "position">, Point>;
    pointToEntityMap: WeakMap<Point, SystemEntity<Entity, "position">>;
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

onInit((game) => {
  const entityToPointMap = new WeakMap<
    SystemEntity<Entity, "position">,
    Point
  >();
  const pointToEntityMap = new WeakMap<
    Point,
    SystemEntity<Entity, "position">
  >();
  const kd = new KdTree();
  dataMap.set(game, { entityToPointMap, pointToEntityMap, kd });

  game.addSystem({
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
  });
});
