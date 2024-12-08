import { data } from "../data.ts";
import { Entity } from "../ecs.ts";
import { Player } from "../ui/vars/players.ts";

export const isEnemy = (source: Entity, target: Entity | Player) => {
  const sourceIsSheep = data.sheep.some((s) => s.id === source.owner);
  const targetIsSheep = data.sheep.some((s) =>
    s.id === ("owner" in target ? target.owner ?? target.id : target.id)
  );
  return sourceIsSheep !== targetIsSheep;
};

export const isAlly = (source: Entity, target: Entity | Player) =>
  !isEnemy(source, target);
