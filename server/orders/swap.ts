import { Buff } from "@/shared/types.ts";
import { findActionByOrder } from "@/shared/util/actionLookup.ts";
import { OrderOverride } from "./types.ts";
import { appContext } from "@/shared/context.ts";

const findMirror = (unit: { owner?: string }) =>
  Array.from(appContext.current.entities).find((e) =>
    e.isMirror && e.owner === unit.owner && e.position
  );

export const swapOrder = {
  // Swap requires an existing mirror image to swap with (mana is checked generically).
  canExecute: (unit) => {
    const mirror = findMirror(unit);
    return !!(mirror && mirror.position && unit.position);
  },

  onCastStart: (unit) => {
    const action = findActionByOrder(unit, "swap");
    if (!action || action.type !== "auto") return;

    const mirror = findMirror(unit);
    if (!mirror || !mirror.position || !unit.position) return;

    // Add buff to mirror with swap model for visual effect during cast
    const buffDuration = action.castDuration ?? 1.5;
    mirror.buffs = [
      ...(mirror.buffs ?? []),
      {
        name: "Swapping",
        description: "Preparing to swap positions",
        remainingDuration: buffDuration,
        model: "swap",
      },
    ];

    unit.buffs = [
      ...(unit.buffs ?? []),
      {
        name: "Swapping",
        description: "Preparing to swap positions",
        remainingDuration: buffDuration,
        model: "swap",
      },
    ];
  },

  onCastComplete: (unit) => {
    const action = findActionByOrder(unit, "swap");
    if (!action || action.type !== "auto") return false;

    const mirror = findMirror(unit);
    if (!mirror || !mirror.position || !unit.position) return false;

    // Remove the swap buff from mirror
    if (mirror.buffs) {
      mirror.buffs = mirror.buffs.filter((buff: Buff) =>
        buff.expiration !== "Swap"
      );
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
