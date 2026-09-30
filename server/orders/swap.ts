import { Buff, Entity } from "@/shared/types.ts";
import { findActionByOrder } from "@/shared/util/actionLookup.ts";
import { OrderOverride } from "./types.ts";
import { appContext } from "@/shared/context.ts";
import { addBuff } from "./effects.ts";

const findMirror = (unit: Entity) => {
  for (const e of appContext.current.entities) {
    if (e.isMirror && e.owner === unit.owner && e.position) return e;
  }
};

const swappingBuff = (remainingDuration: number): Buff => ({
  name: "Swapping",
  description: "Preparing to swap positions",
  remainingDuration,
  model: "swap",
});

export const swapOrder = {
  // Swap requires an existing mirror image to swap with (mana is checked generically).
  canExecute: (unit) => !!(unit.position && findMirror(unit)),

  onCastStart: (unit) => {
    const action = findActionByOrder(unit, "swap");
    if (!action || action.type !== "auto" || !unit.position) return;

    const mirror = findMirror(unit);
    if (!mirror) return;

    // Both units show the swap model for the duration of the cast
    const buffDuration = action.castDuration ?? 1.5;
    addBuff(mirror, swappingBuff(buffDuration));
    addBuff(unit, swappingBuff(buffDuration));
  },

  onCastComplete: (unit) => {
    const action = findActionByOrder(unit, "swap");
    if (!action || action.type !== "auto" || !unit.position) return false;

    const mirror = findMirror(unit);
    if (!mirror?.position) return false;

    // Remove the swap buff from mirror
    if (mirror.buffs) {
      mirror.buffs = mirror.buffs.filter((buff) => buff.expiration !== "Swap");
    }

    // Store target positions
    const unitPos = { x: unit.position.x, y: unit.position.y };
    const mirrorPos = { x: mirror.position.x, y: mirror.position.y };

    // Swap facing immediately (no pathing concerns)
    [unit.facing, mirror.facing] = [mirror.facing, unit.facing];

    // Move both units to infinity to clear pathing map
    unit.position = { x: Infinity, y: Infinity };
    mirror.position = { x: Infinity, y: Infinity };

    // Enqueue the actual position swap to happen after pathing updates
    appContext.current.enqueue(() => {
      unit.position = mirrorPos;
      mirror.position = unitPos;
    });

    return true;
  },
} satisfies OrderOverride;
