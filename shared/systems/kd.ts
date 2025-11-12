import { Point } from "@/shared/pathing/math.ts";
import { Entity, SystemEntity } from "@/shared/types.ts";
import { KdTree } from "@/shared/util/KDTree.ts";
import { addSystem, appContext } from "@/shared/context.ts";
import { App } from "@verit/ecs";

export const dataMap = new WeakMap<
  App<Entity>,
  {
    entityToPointMap: Map<Entity, Point>;
    pointToEntityMap: Map<Point, Entity>;
    kd: KdTree;
    entities: Set<SystemEntity<"position">>;
    editorMode: boolean;
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

export const getNearestEntity = (
  x: number,
  y: number,
  filter: (entity: Entity) => boolean,
): Entity | null => {
  const data = dataMap.get(appContext.current);
  if (!data) throw new Error("Expected kd system to have initialized data");

  const pointFilter = (point: Point) => {
    const entity = data.pointToEntityMap.get(point);
    return entity ? filter(entity) : false;
  };

  const point = data.kd.nearest(x, y, pointFilter);
  if (!point) return null;
  return data.pointToEntityMap.get(point) ?? null;
};

addSystem<Entity, "position">((app) => {
  const entityToPointMap = new Map<Entity, Point>();
  const pointToEntityMap = new Map<Point, Entity>();
  const kd = new KdTree();
  const entities = new Set<SystemEntity<"position">>();
  const data = {
    entityToPointMap,
    pointToEntityMap,
    kd,
    entities,
    editorMode: false,
  };
  dataMap.set(app, data);

  const addOrUpdateEntity = (e: SystemEntity<"position">) => {
    const prev = entityToPointMap.get(e);
    if (prev) {
      kd.replace(prev, e.position);
      pointToEntityMap.delete(prev);
    } else {
      kd.add(e.position);
    }
    entityToPointMap.set(e, e.position);
    pointToEntityMap.set(e.position, e);
  };

  return {
    props: ["position"],
    entities,
    onAdd: (e) => {
      if (e.type === "cosmetic" && !data.editorMode) return;
      addOrUpdateEntity(e);
    },
    onChange: (e) => {
      if (e.type === "cosmetic" && !data.editorMode) return;
      addOrUpdateEntity(e);
    },
    onRemove: (e) => {
      if (e.type === "cosmetic" && !data.editorMode) return;
      const prev = entityToPointMap.get(e);
      if (!prev) return;
      kd.delete(prev);
      entityToPointMap.delete(e);
      pointToEntityMap.delete(prev);
    },
  };
});

export const switchToEditorMode = () => {
  const data = dataMap.get(appContext.current);
  if (!data) throw new Error("Expected kd system to have initialized data");

  data.editorMode = true;
  for (const e of data.entities) {
    if (e.type !== "cosmetic") continue;
    const prev = data.entityToPointMap.get(e);
    if (prev) {
      data.kd.replace(prev, e.position);
      data.pointToEntityMap.delete(prev);
    } else {
      data.kd.add(e.position);
    }
    data.entityToPointMap.set(e, e.position);
    data.pointToEntityMap.set(e.position, e);
  }
};
