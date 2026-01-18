import { Entity } from "../types.ts";
import { Classification } from "../data.ts";
import { getEntitiesInRange } from "../systems/kd.ts";
import { getBuffRemainingDuration, testClassification } from "../api/unit.ts";
import { distanceBetweenEntities } from "../pathing/math.ts";

export const findAutoTarget = (
  caster: Entity,
  range: number,
  targeting: ReadonlyArray<ReadonlyArray<Classification>> | undefined,
  buffName: string | undefined,
  priorityOwnerId: string | undefined,
): Entity | undefined => {
  if (!caster.position) return undefined;

  const candidates = getEntitiesInRange(
    caster.position.x,
    caster.position.y,
    range,
  ).filter((e) =>
    e.id !== caster.id &&
    e.position &&
    (!targeting || testClassification(caster, e, targeting))
  );

  if (candidates.length === 0) return undefined;

  // Sort by priority:
  // 1. Favor priority owner's units (local player on client, caster's owner on server)
  // 2. Units without the buff (or with less remaining duration)
  // 3. Distance (closer is better)
  candidates.sort((a, b) => {
    // Priority 1: Priority owner's units first
    if (priorityOwnerId) {
      const aIsOwn = a.owner === priorityOwnerId;
      const bIsOwn = b.owner === priorityOwnerId;
      if (aIsOwn !== bIsOwn) return aIsOwn ? -1 : 1;
    }

    // Priority 2: Units without buff, then by remaining duration
    if (buffName) {
      const aDuration = getBuffRemainingDuration(a, buffName);
      const bDuration = getBuffRemainingDuration(b, buffName);
      const aHasBuff = aDuration !== undefined;
      const bHasBuff = bDuration !== undefined;

      if (aHasBuff !== bHasBuff) return aHasBuff ? 1 : -1;
      if (aHasBuff && bHasBuff) {
        if (aDuration !== bDuration) return aDuration - bDuration;
      }
    }

    // Priority 3: Distance (closer first)
    const aDist = distanceBetweenEntities(caster, a);
    const bDist = distanceBetweenEntities(caster, b);
    return aDist - bDist;
  });

  return candidates[0];
};
