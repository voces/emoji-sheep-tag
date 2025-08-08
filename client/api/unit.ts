import { tempUnit } from "@/shared/api/unit.ts";
import {
  Classification,
  ClassificationGroup,
  classificationGroups,
} from "@/shared/data.ts";
import { isPathingEntity } from "@/shared/pathing/util.ts";
import { data } from "../data.ts";
import { Entity } from "../ecs.ts";
import { pathable, pathingMap } from "../systems/pathing.ts";
import { getLocalPlayer, Player } from "../ui/vars/players.ts";
import { absurd } from "@/shared/util/absurd.ts";

export const isEnemy = (source: Entity, target: Entity | Player) => {
  const sourceTeam = data.sheep.some((s) => s.id === source.owner)
    ? "sheep"
    : data.wolves.some((w) => w.id === source.owner)
    ? "wolf"
    : "neutral";
  const targetPlayer = "owner" in target
    ? target.owner ?? target.id
    : target.id;
  const targetTeam = data.sheep.some((s) => s.id === targetPlayer)
    ? "sheep"
    : data.wolves.some((w) => w.id === targetPlayer)
    ? "wolf"
    : "neutral";
  return sourceTeam !== targetTeam && sourceTeam !== "neutral" &&
    targetTeam !== "neutral";
};

export const isAlly = (source: Entity, target: Entity | Player) => {
  const sourceTeam = data.sheep.some((s) => s.id === source.owner)
    ? "sheep"
    : data.wolves.some((w) => w.id === source.owner)
    ? "wolf"
    : "neutral";
  const targetPlayer = "owner" in target
    ? target.owner ?? target.id
    : target.id;
  const targetTeam = data.sheep.some((s) => s.id === targetPlayer)
    ? "sheep"
    : data.wolves.some((w) => w.id === targetPlayer)
    ? "wolf"
    : "neutral";
  return sourceTeam === targetTeam && sourceTeam !== "neutral";
};

export const isNeutral = (source: Entity, target: Entity | Player) => {
  const targetPlayer = "owner" in target
    ? target.owner ?? target.id
    : target.id;
  return (!data.sheep.some((s) => s.id === source.owner) &&
    data.wolves.some((w) => w.id === source.owner)) ||
    (!data.sheep.some((s) => s.id === targetPlayer) &&
      data.wolves.some((w) => w.id === targetPlayer));
};

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

const classificationToGroup = {} as {
  [key in Classification]: ClassificationGroup;
};
for (const group in classificationGroups) {
  for (
    const classification
      of classificationGroups[group as keyof typeof classificationGroups]
  ) {
    classificationToGroup[classification] =
      group as keyof typeof classificationGroups;
  }
}

export const testClassification = (
  source: Entity,
  target: Entity,
  classifications: ReadonlyArray<Classification> | undefined,
) => {
  if (!classifications) return true;
  const groups = classifications.reduce(
    (groups, classification) => {
      const group = classificationToGroup[classification];
      if (!groups[group]) groups[group] = [];
      groups[group].push(classification as never);
      return groups;
    },
    {} as {
      [key in ClassificationGroup]: typeof classificationGroups[key][number][];
    },
  );

  for (const g in groups) {
    const group = g as ClassificationGroup;
    switch (group) {
      case "alliance":
        if (
          !groups[group]!.some((classification) => {
            switch (classification) {
              case "ally":
                return isAlly(source, target);
              case "enemy":
                return isEnemy(source, target);
              case "neutral":
                return isNeutral(source, target);
              default:
                absurd(classification);
            }
          })
        ) return false;
        break;
      case "identity":
        if (
          !groups[group].some((classification) => {
            switch (classification) {
              case "other":
                return source !== target;
              case "self":
                return source === target;
              default:
                absurd(classification);
            }
          })
        ) return false;
        break;
      case "structureOrUnit":
        if (
          !groups[group].some((classification) => {
            switch (classification) {
              case "structure":
                return !!target.tilemap;
              case "unit":
                return !target.tilemap;
              default:
                absurd(classification);
            }
          })
        ) return false;
        break;
      default:
        absurd(group);
    }
  }
  return true;
};
