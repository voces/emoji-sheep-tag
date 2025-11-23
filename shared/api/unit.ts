import { DEFAULT_FACING } from "../constants.ts";
import {
  Classification,
  ClassificationGroup,
  classificationGroups,
  defaultClassifications,
} from "../data.ts";
import { Buff, Entity } from "../types.ts";
import { absurd } from "../util/absurd.ts";
import { mergeEntityWithPrefab } from "./entity.ts";
import { getPlayer } from "./player.ts";

/**
 * Iterates over all buffs on an entity, including both direct buffs and buffs from inventory items.
 * Yields each buff for processing.
 */
export function* iterateBuffs(entity: Entity): Generator<Buff> {
  // Yield direct buffs
  if (entity.buffs) {
    for (const buff of entity.buffs) {
      yield buff;
    }
  }

  // Yield buffs from inventory items
  if (entity.inventory) {
    for (const item of entity.inventory) {
      if (item.buffs) {
        for (const buff of item.buffs) {
          yield buff;
        }
      }
    }
  }
}

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
    facing: DEFAULT_FACING,
    ...extra,
  }) as Entity;

export const computeUnitMovementSpeed = (unit: Entity): number => {
  const baseSpeed = unit.movementSpeed ?? 0;
  let flatSpeedBonus = 0;
  let speedMultiplier = 1.0;

  // Add flat bonuses and multipliers from buffs (including item buffs)
  for (const buff of iterateBuffs(unit)) {
    if (buff.movementSpeedBonus) {
      flatSpeedBonus += buff.movementSpeedBonus;
    }
    if (buff.movementSpeedMultiplier) {
      speedMultiplier *= buff.movementSpeedMultiplier;
    }
  }

  // Apply multipliers first, then add flat bonuses
  return baseSpeed * speedMultiplier + flatSpeedBonus;
};

/**
 * Computes the total damage a unit can deal, including base damage plus bonuses from items and buffs
 */
export const computeUnitDamage = (unit: Entity): number => {
  if (!unit.attack) return 0;

  let totalDamage = unit.attack.damage;

  // Apply multipliers first, then add bonuses from buffs (including item buffs)
  for (const buff of iterateBuffs(unit)) {
    if (buff.damageMultiplier) {
      totalDamage *= buff.damageMultiplier;
    }
  }

  for (const buff of iterateBuffs(unit)) {
    if (buff.damageBonus) {
      totalDamage += buff.damageBonus;
    }
  }

  return totalDamage;
};

/**
 * Computes the effective attack speed multiplier for a unit, including bonuses from items and buffs
 */
export const computeUnitAttackSpeed = (unit: Entity): number => {
  let speedMultiplier = 1.0;

  // Apply attack speed bonuses from buffs (including item buffs)
  for (const buff of iterateBuffs(unit)) {
    if (buff.attackSpeedMultiplier) {
      speedMultiplier *= buff.attackSpeedMultiplier;
    }
  }

  return speedMultiplier;
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

const simpleTeam = (team: Entity["team"]) => {
  if (team === "sheep") return "sheep";
  if (team === "wolf") return "wolf";
  return "neutral";
};

export const isAlly = (source: Entity | string, target: Entity | string) => {
  if (typeof target !== "string") {
    if (target.targetedAs?.includes("ally")) return true;
    if (
      target.targetedAs?.includes("enemy") ||
      target.targetedAs?.includes("neutral")
    ) return false;
  }
  const sourcePlayer = typeof source === "string" ? source : source.owner;
  const sourceTeam = simpleTeam(getPlayer(sourcePlayer)?.team);
  const targetPlayer = typeof target === "string" ? target : target.owner;
  const targetTeam = simpleTeam(getPlayer(targetPlayer)?.team);
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
  const sourceTeam = simpleTeam(getPlayer(sourcePlayer)?.team);
  const targetPlayer = typeof target === "string" ? target : target.owner;
  const targetTeam = simpleTeam(getPlayer(targetPlayer)?.team);
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
  const sourceTeam = simpleTeam(getPlayer(sourcePlayer)?.team);
  if (sourceTeam === "neutral") return true;
  const targetPlayer = typeof target === "string" ? target : target.owner;
  const targetTeam = simpleTeam(getPlayer(targetPlayer)?.team);
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
    entity.targetedAs?.includes("unit") ||
    entity.targetedAs?.includes("tree") ||
    entity.targetedAs?.includes("ward")
  ) return false;
  return !!entity.tilemap;
};

export const isUnit = (entity: Entity) => {
  if (entity.type === "cosmetic") return false;
  if (entity.targetedAs?.includes("unit")) return true;
  if (
    entity.targetedAs?.includes("structure") ||
    entity.targetedAs?.includes("tree") ||
    entity.targetedAs?.includes("ward")
  ) return false;
  return !!entity.movementSpeed;
};

export const isTree = (entity: Entity) => !!entity.targetedAs?.includes("tree");

export const isWard = (entity: Entity) => {
  if (entity.targetedAs?.includes("ward")) return true;
  if (
    entity.targetedAs?.includes("unit") ||
    entity.targetedAs?.includes("tree") ||
    entity.targetedAs?.includes("structure")
  ) return false;
  return !entity.tilemap && !entity.movementSpeed && !entity.isDoodad &&
    !!entity.owner;
};

const isSpirit = (entity: Entity) => !!entity.targetedAs?.includes("spirit");

const isNotSpirit = (entity: Entity) => {
  if (entity.targetedAs?.includes("notSpirit")) return true;
  if (entity.targetedAs?.includes("spirit")) return false;
  return true;
};

const defaultClassificationsFlat = [
  Object.values(defaultClassifications).flat(),
];

export const testClassification = (
  source: Entity,
  target: Entity,
  classifications: ReadonlyArray<ReadonlyArray<Classification>> =
    defaultClassificationsFlat,
): boolean => {
  // if (!classifications?.length) return true;

  // Outer array is OR - at least one must match
  return classifications.some((andClassifications) => {
    // Inner array is AND - all must match
    const groups = andClassifications.reduce(
      (groups, c) => {
        const group = classificationToGroup[c];
        if (!groups[group]) groups[group] = [];
        groups[group].push(c as never);
        return groups;
      },
      {} as {
        [key in ClassificationGroup]:
          typeof classificationGroups[key][number][];
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
                  case "ward":
                    return isWard(target);
                  default:
                    throw absurd(classification);
                }
              },
            )
          ) {
            return false;
          }
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
  });
};
