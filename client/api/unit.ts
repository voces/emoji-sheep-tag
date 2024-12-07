import { data } from "../data.ts";
import { Entity } from "../ecs.ts";

export const isEnemy = (source: Entity, target: Entity) => {
  const sourceIsSheep = data.sheep.some((s) => s.id === source.owner);
  const targetIsSheep = data.sheep.some((s) => s.id === target.owner);
  return sourceIsSheep !== targetIsSheep;
};
