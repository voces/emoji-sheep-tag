import { tempUnit } from "../../shared/api/unit.ts";
import { isPathingEntity } from "../../shared/pathing/util.ts";
import { data } from "../data.ts";
import { Entity } from "../ecs.ts";
import { pathable, pathingMap } from "../systems/pathing.ts";
import { getLocalPlayer, Player } from "../ui/vars/players.ts";

export const isEnemy = (source: Entity, target: Entity | Player) => {
  const sourceIsSheep = data.sheep.some((s) => s.id === source.owner);
  const targetIsSheep = data.sheep.some((s) =>
    s.id === ("owner" in target ? target.owner ?? target.id : target.id)
  );
  return sourceIsSheep !== targetIsSheep;
};

export const isAlly = (source: Entity, target: Entity | Player) =>
  !isEnemy(source, target);

export const canBuild = (
  builder: Entity,
  buildType: string,
  x: number,
  y: number,
) => {
  if (!isPathingEntity(builder)) return false;
  return pathingMap.withoutEntity(
    builder,
    () => pathable(tempUnit(getLocalPlayer()!.id, buildType, x, y)),
  );
};
