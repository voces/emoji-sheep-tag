import { addSystem } from "@/shared/context.ts";
import { getEntitiesInRange } from "./kd.ts";
import { buffs } from "@/shared/data.ts";
import { iterateBuffs, testClassification } from "@/shared/api/unit.ts";
import { lookup } from "./lookup.ts";
import type { Buff, Entity } from "@/shared/types.ts";

// Track which entities have which aura buffs applied (auraSourceId-auraBuffId -> Set of targetIds)
const auraApplications = new Map<string, Set<string>>();

// Shared handler for aura updates
const handleAuraUpdate = (entity: Entity) => {
  if (!entity.position) return;

  // Find buffs with aura properties (from direct buffs and item buffs)
  const auraBuffs = Array.from(iterateBuffs(entity)).filter((buff) =>
    buff.radius && buff.auraBuff
  );

  // Track which targets should have auras from this entity
  const currentlyInRange = new Map<string, Set<string>>(); // auraBuffId -> Set of targetIds

  // For each aura buff, apply it to nearby entities
  for (const auraBuff of auraBuffs) {
    if (!auraBuff.radius || !auraBuff.auraBuff) continue;

    const buffDefinition = buffs[auraBuff.auraBuff];
    if (!buffDefinition) continue;

    const auraKey = `${entity.id}-${auraBuff.auraBuff}`;
    const targetsInRange = new Set<string>();

    // Get entities in range
    const nearbyEntities = getEntitiesInRange(
      entity.position.x,
      entity.position.y,
      auraBuff.radius,
    );

    // Apply buff to each nearby entity
    for (const target of nearbyEntities) {
      // Skip self
      if (target.id === entity.id) continue;

      // Skip if no position
      if (!target.position) continue;

      // Check if this buff should apply to this target using targetsAllowed from the aura buff
      if (!auraBuff.targetsAllowed) continue;

      const shouldApply = testClassification(
        entity,
        target,
        auraBuff.targetsAllowed,
      );

      if (!shouldApply) continue;

      targetsInRange.add(target.id);

      // Check if target already has this specific aura buff from this source
      const existingAuraBuffIndex = target.buffs?.findIndex((b) =>
        b.auraBuff === auraBuff.auraBuff
      );

      if (existingAuraBuffIndex !== undefined && existingAuraBuffIndex >= 0) {
        // Aura is being reapplied - remove any linger duration if it exists
        const existingAuraBuff = target.buffs![existingAuraBuffIndex];
        if (existingAuraBuff.remainingDuration !== undefined) {
          // Replace with a new buff without the duration (only update if duration exists)
          const { remainingDuration: _removed, ...buffWithoutDuration } =
            existingAuraBuff;
          target.buffs = [
            ...target.buffs!.slice(0, existingAuraBuffIndex),
            buffWithoutDuration,
            ...target.buffs!.slice(existingAuraBuffIndex + 1),
          ];
        }
        // If no remainingDuration, buff is already correct - no update needed (referential stability)
      } else {
        // Add the aura buff to the target (with auraBuff marker for tracking)
        const existingBuffs = target.buffs ?? [];
        target.buffs = [...existingBuffs, {
          ...buffDefinition,
          auraBuff: auraBuff.auraBuff,
        }];
      }
    }

    currentlyInRange.set(auraBuff.auraBuff, targetsInRange);

    // Clean up aura buffs from entities that left range
    const previousTargets = auraApplications.get(auraKey) ?? new Set();
    for (const targetId of previousTargets) {
      if (!targetsInRange.has(targetId)) {
        // Target left range, add 2-second linger duration
        const target = lookup(targetId);
        if (target?.buffs) {
          const auraBuffIndex = target.buffs.findIndex((b: Buff) =>
            b.auraBuff === auraBuff.auraBuff
          );

          if (auraBuffIndex >= 0) {
            const existingAuraBuff = target.buffs[auraBuffIndex];
            // Only add duration if it doesn't already have one (to avoid resetting the timer)
            if (existingAuraBuff.remainingDuration === undefined) {
              target.buffs = [
                ...target.buffs.slice(0, auraBuffIndex),
                { ...existingAuraBuff, remainingDuration: 2 },
                ...target.buffs.slice(auraBuffIndex + 1),
              ];
            }
          }
        }
      }
    }

    // Update tracking
    auraApplications.set(auraKey, targetsInRange);
  }
};

// Shared handler for aura removal
const handleAuraRemove = (entity: Entity) => {
  // When an aura source is removed, add linger duration to all its aura buffs
  const auraBuffs = Array.from(iterateBuffs(entity)).filter((buff) =>
    buff.radius && buff.auraBuff
  );

  for (const auraBuff of auraBuffs) {
    if (!auraBuff.auraBuff) continue;

    const auraKey = `${entity.id}-${auraBuff.auraBuff}`;
    const targets = auraApplications.get(auraKey);

    if (targets) {
      // Add 2-second linger duration to aura buffs on all affected targets
      for (const targetId of targets) {
        const target = lookup(targetId);
        if (target?.buffs) {
          const auraBuffIndex = target.buffs.findIndex((b: Buff) =>
            b.auraBuff === auraBuff.auraBuff
          );

          if (auraBuffIndex >= 0) {
            const existingAuraBuff = target.buffs[auraBuffIndex];
            // Only add duration if it doesn't already have one
            if (existingAuraBuff.remainingDuration === undefined) {
              target.buffs = [
                ...target.buffs.slice(0, auraBuffIndex),
                { ...existingAuraBuff, remainingDuration: 2 },
                ...target.buffs.slice(auraBuffIndex + 1),
              ];
            }
          }
        }
      }

      auraApplications.delete(auraKey);
    }
  }
};

// System for entities with buffs
addSystem((_app) => ({
  props: ["buffs"] as const,
  updateEntity: handleAuraUpdate,
  onRemove: handleAuraRemove,
}));

// System for entities with inventory (for item aura buffs)
addSystem((_app) => ({
  props: ["inventory"] as const,
  updateEntity: handleAuraUpdate,
  onRemove: handleAuraRemove,
}));
