import {
  Classification,
  ClassificationGroup,
  classificationGroups,
  prefabs,
} from "../data.ts";
import { Entity } from "../types.ts";
import { absurd } from "../util/absurd.ts";
import { getPlayerTeam } from "./player.ts";

export const tempUnit = (
  owner: string,
  type: string,
  x: number,
  y: number,
  extra?: Partial<Entity>,
): Entity => ({
  id: "",
  prefab: type,
  owner,
  position: { x, y },
  facing: Math.PI,
  ...(typeof prefabs[type]?.maxHealth === "number"
    ? { health: prefabs[type]?.maxHealth }
    : undefined),
  ...prefabs[type],
  ...extra,
});

export const computeUnitMovementSpeed = (unit: Entity): number => {
  const baseSpeed = unit.movementSpeed ?? 0;
  let flatSpeedBonus = 0;
  let speedMultiplier = 1.0;

  // Add flat bonuses from items
  if (unit.inventory) {
    for (const item of unit.inventory) {
      if (item.movementSpeedBonus) {
        flatSpeedBonus += item.movementSpeedBonus;
      }
    }
  }

  // Add flat bonuses and multipliers from buffs
  if (unit.buffs) {
    for (const buff of unit.buffs) {
      if (buff.movementSpeedBonus) {
        flatSpeedBonus += buff.movementSpeedBonus;
      }
      if (buff.movementSpeedMultiplier) {
        speedMultiplier *= buff.movementSpeedMultiplier;
      }
    }
  }

  // Apply flat bonuses first, then multipliers
  return (baseSpeed + flatSpeedBonus) * speedMultiplier;
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

export const isAlly = (source: Entity | string, target: Entity | string) => {
  const sourcePlayer = typeof source === "string" ? source : source.owner;
  const sourceTeam = sourcePlayer ? getPlayerTeam(sourcePlayer) : "neutral";
  const targetPlayer = typeof target === "string" ? target : target.owner;
  const targetTeam = targetPlayer ? getPlayerTeam(targetPlayer) : "neutral";
  return sourceTeam === targetTeam && sourceTeam !== "neutral";
};

export const isEnemy = (source: Entity | string, target: Entity | string) => {
  const sourcePlayer = typeof source === "string" ? source : source.owner;
  const sourceTeam = sourcePlayer ? getPlayerTeam(sourcePlayer) : "neutral";
  const targetPlayer = typeof target === "string" ? target : target.owner;
  const targetTeam = targetPlayer ? getPlayerTeam(targetPlayer) : "neutral";
  return sourceTeam !== targetTeam && sourceTeam !== "neutral" &&
    targetTeam !== "neutral";
};

export const isNeutral = (source: Entity | string, target: Entity | string) => {
  const sourcePlayer = typeof source === "string" ? source : source.owner;
  const sourceTeam = sourcePlayer ? getPlayerTeam(sourcePlayer) : "neutral";
  if (sourceTeam === "neutral") return true;
  const targetPlayer = typeof target === "string" ? target : target.owner;
  const targetTeam = targetPlayer ? getPlayerTeam(targetPlayer) : "neutral";
  return targetTeam === "neutral";
};

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
                throw absurd(classification);
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
                throw absurd(classification);
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
                throw absurd(classification);
            }
          })
        ) return false;
        break;
      default:
        throw absurd(group);
    }
  }
  return true;
};
