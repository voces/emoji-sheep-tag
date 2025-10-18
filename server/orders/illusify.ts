import { OrderDefinition } from "./types.ts";
import { appContext } from "@/shared/context.ts";

export const illusifyOrder = {
  id: "illusify",

  onIssue: (unit, _, queue) => {
    if (!unit.tilemap) return "failed";
    if (queue) {
      unit.queue = [...unit.queue ?? [], {
        type: "cast",
        orderId: "illusify",
        remaining: 0,
      }];
      return "ordered";
    }
    return "immediate";
  },

  onCastComplete: (unit) => {
    if (!unit.tilemap || !unit.position) return false;

    // Replace all tiles with 16 (passable tile)
    unit.tilemap = {
      ...unit.tilemap,
      map: unit.tilemap.map.map((t) => t ? 16 : 0),
    };

    unit.isMirror = true;

    appContext.current.enqueue(() => {
      // Remove the illusify action and all upgrade actions after use
      if (unit.actions) {
        unit.actions = unit.actions.filter((action) =>
          !(action.type === "auto" && action.order === "illusify") &&
          action.type !== "upgrade"
        );
      }
    });

    return true;
  },
} satisfies OrderDefinition;
