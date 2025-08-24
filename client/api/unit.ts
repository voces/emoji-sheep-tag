import { tempUnit } from "@/shared/api/unit.ts";
import { isPathingEntity } from "@/shared/pathing/util.ts";
import { Entity } from "../ecs.ts";
import { pathable, pathingMap } from "../systems/pathing.ts";
import { getLocalPlayer } from "../ui/vars/players.ts";

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
