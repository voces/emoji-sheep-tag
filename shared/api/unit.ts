import {
  Classification,
  ClassificationGroup,
  classificationGroups,
  defaultClassifications,
} from "../data.ts";
import { Entity } from "../types.ts";
import { absurd } from "../util/absurd.ts";
import { getPlayerTeam } from "./player.ts";
import { mergeEntityWithPrefab } from "./entity.ts";

export const tempUnit = (
  owner: string,
  type: string,
  x: number,
  y: number,
  extra?: Partial<Entity>,
): Entity =>
  mergeEntityWithPrefab({
    id: "",
    prefab: type,
    owner,
    position: { x, y },
    ...extra,
  }) as Entity;

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
  if (typeof target !== "string") {
    if (target.targetedAs?.includes("ally")) return true;
    if (
      target.targetedAs?.includes("enemy") ||
      target.targetedAs?.includes("neutral")
    ) return false;
  }
  const sourcePlayer = typeof source === "string" ? source : source.owner;
  const sourceTeam = sourcePlayer ? getPlayerTeam(sourcePlayer) : "neutral";
  const targetPlayer = typeof target === "string" ? target : target.owner;
  const targetTeam = targetPlayer ? getPlayerTeam(targetPlayer) : "neutral";
  return sourceTeam === targetTeam && sourceTeam !== "neutral";
};

export const isEnemy = (source: Entity | string, target: Entity | string) => {
  if (typeof target !== "string") {
    if (target.targetedAs?.includes("enemy")) return true;
    if (
      target.targetedAs?.includes("ally") ||
      target.targetedAs?.includes("neutral")
    ) return false;
  }
  const sourcePlayer = typeof source === "string" ? source : source.owner;
  const sourceTeam = sourcePlayer ? getPlayerTeam(sourcePlayer) : "neutral";
  const targetPlayer = typeof target === "string" ? target : target.owner;
  const targetTeam = targetPlayer ? getPlayerTeam(targetPlayer) : "neutral";
  return sourceTeam !== targetTeam && sourceTeam !== "neutral" &&
    targetTeam !== "neutral";
};

export const isNeutral = (source: Entity | string, target: Entity | string) => {
  if (typeof target !== "string") {
    if (target.targetedAs?.includes("neutral")) return true;
    if (
      target.targetedAs?.includes("ally") ||
      target.targetedAs?.includes("enemy")
    ) return false;
  }
  const sourcePlayer = typeof source === "string" ? source : source.owner;
  const sourceTeam = sourcePlayer ? getPlayerTeam(sourcePlayer) : "neutral";
  if (sourceTeam === "neutral") return true;
  const targetPlayer = typeof target === "string" ? target : target.owner;
  const targetTeam = targetPlayer ? getPlayerTeam(targetPlayer) : "neutral";
  return targetTeam === "neutral";
};

const isOther = (source: Entity, target: Entity) => {
  if (target.targetedAs?.includes("other")) return true;
  if (target.targetedAs?.includes("self")) return false;
  return source !== target;
};

const isSelf = (source: Entity, target: Entity) => {
  if (target.targetedAs?.includes("self")) return true;
  if (target.targetedAs?.includes("other")) return false;
  return source === target;
};

export const isStructure = (entity: Entity) => {
  if (entity.targetedAs?.includes("structure")) return true;
  if (
    entity.targetedAs?.includes("unit") || entity.targetedAs?.includes("tree")
  ) return false;
  return !!entity.tilemap;
};

export const isUnit = (entity: Entity) => {
  if (entity.targetedAs?.includes("unit")) return true;
  if (
    entity.targetedAs?.includes("structure") ||
    entity.targetedAs?.includes("tree")
  ) return false;
  return !!entity.movementSpeed;
};

export const isTree = (entity: Entity) => !!entity.targetedAs?.includes("tree");

const isSpirit = (entity: Entity) => !!entity.targetedAs?.includes("spirit");

const isNotSpirit = (entity: Entity) => {
  if (entity.targetedAs?.includes("notSpirit")) return true;
  if (entity.targetedAs?.includes("spirit")) return false;
  return true;
};

export const testClassification = (
  source: Entity,
  target: Entity,
  classifications: ReadonlyArray<Classification> = [],
): boolean => {
  // if (!classifications?.length) return true;
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

  for (const g in classificationGroups) {
    const group = g as ClassificationGroup;
    switch (group) {
      case "alliance":
        if (
          !(groups[group] ?? defaultClassifications[group]).some(
            (classification) => {
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
            },
          )
        ) return false;
        break;
      case "identity":
        if (
          !(groups[group] ?? defaultClassifications[group]).some(
            (classification) => {
              switch (classification) {
                case "other":
                  return isOther(source, target);
                case "self":
                  return isSelf(source, target);
                default:
                  throw absurd(classification);
              }
            },
          )
        ) return false;
        break;
      case "destructibles":
        if (
          !(groups[group] ?? defaultClassifications[group]).some(
            (classification) => {
              switch (classification) {
                case "structure":
                  return isStructure(target);
                case "unit":
                  return isUnit(target);
                case "tree":
                  return isTree(target);
                default:
                  throw absurd(classification);
              }
            },
          )
        ) return false;
        break;
      case "spirit":
        if (
          !(groups[group] ?? defaultClassifications[group]).some(
            (classification) => {
              switch (classification) {
                case "notSpirit":
                  return isNotSpirit(target);
                case "spirit":
                  return isSpirit(target);
                default:
                  throw absurd(classification);
              }
            },
          )
        ) return false;
        break;
      default:
        throw absurd(group);
    }
  }

  return true;
};
