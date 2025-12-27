import { Buff, Order } from "@/shared/types.ts";
import { findActionByOrder } from "@/shared/util/actionLookup.ts";
import { OrderDefinition } from "./types.ts";
import { appContext } from "@/shared/context.ts";

export const swapOrder = {
  id: "swap",

  onIssue: (unit, _, queue) => {
    const action = findActionByOrder(unit, "swap");
    if (!action || action.type !== "auto") return "failed";

    // Check if unit has enough mana
    const manaCost = action.manaCost ?? 0;
    if (typeof unit.mana !== "number" || unit.mana < manaCost) {
      return "failed";
    }

    // Find the mirror image
    const mirror = Array.from(appContext.current.entities).find((e) =>
      e.isMirror && e.owner === unit.owner && e.position
    );

    if (!mirror || !mirror.position || !unit.position) return "failed";

    const order: Order = {
      type: "cast",
      orderId: "swap",
      remaining: action.castDuration ?? 0,
    };

    if (queue) {
      unit.queue = [...unit.queue ?? [], order];
      return "ordered";
    } else {
      delete unit.queue;
      unit.order = order;
    }

    return "ordered";
  },

  onCastStart: (unit) => {
    const action = findActionByOrder(unit, "swap");
    if (!action || action.type !== "auto") return;

    const mirror = Array.from(appContext.current.entities).find((e) =>
      e.isMirror && e.owner === unit.owner && e.position
    );

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

    // Find the mirror image
    const mirror = Array.from(appContext.current.entities).find((e) =>
      e.isMirror && e.owner === unit.owner && e.position
    );

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
} satisfies OrderDefinition;
