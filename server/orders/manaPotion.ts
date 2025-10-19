import { Order } from "@/shared/types.ts";
import { findActionByOrder } from "../util/actionLookup.ts";
import { OrderDefinition } from "./types.ts";
import { newSfx } from "../api/sfx.ts";
import { interval } from "../api/timing.ts";

export const manaPotionOrder = {
  id: "manaPotion",

  onIssue: (unit, _, queue) => {
    const action = findActionByOrder(unit, "manaPotion");
    if (!action || action.type !== "auto") return "failed";

    // Don't use mana potion if already at full mana
    if (unit.mana !== undefined && unit.maxMana !== undefined) {
      if (unit.mana >= unit.maxMana) return "failed";
    }

    const order: Order = { type: "cast", orderId: "manaPotion", remaining: 0 };

    if (queue) {
      unit.queue = [...unit.queue ?? [], order];
      return "ordered";
    }

    return "immediate";
  },

  onCastComplete: (unit) => {
    const action = findActionByOrder(unit, "manaPotion");
    if (!action || action.type !== "auto" || !action.manaRestore) return false;

    if (unit.mana !== undefined && unit.maxMana !== undefined) {
      unit.mana = Math.min(unit.mana + action.manaRestore, unit.maxMana);
    }

    if (unit.position) {
      let ticks = 0;
      const clear = interval(
        () => {
          if (!unit.position || ticks++ > 10) return clear();
          newSfx(
            {
              x: unit.position.x + Math.random() - 0.5,
              y: unit.position.y + Math.random() - 0.25,
            },
            "sparkle",
            0,
            0.5,
            "ease-in-out",
            0.5,
            { vertexColor: 0x34a5e9 },
          );
        },
        0.1,
      );
    }
  },
} satisfies OrderDefinition;
