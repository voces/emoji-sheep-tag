import { Order } from "@/shared/types.ts";
import { findActionByOrder } from "../util/actionLookup.ts";
import { OrderDefinition } from "./types.ts";
import { newUnit } from "../api/unit.ts";
import {
  DEFAULT_FACING,
  PATHING_NONE,
  PATHING_SOLID,
} from "@/shared/constants.ts";

export const dodgeOrder = {
  id: "dodge",

  onIssue: (unit, _, queue) => {
    const action = findActionByOrder(unit, "dodge");
    if (!action || action.type !== "auto") {
      return "failed";
    }

    const order: Order = { type: "cast", orderId: "dodge", remaining: 0 };

    if (queue) {
      unit.queue = [...unit.queue ?? [], order];
      return "ordered";
    }

    return "immediate";
  },

  onCastComplete: (unit) => {
    const action = findActionByOrder(unit, "dodge");
    if (
      !action || action.type !== "auto" || !unit.position || !unit.prefab ||
      !unit.owner
    ) {
      return false;
    }

    // Add dodge buff
    unit.buffs = [...(unit.buffs || []), {
      remainingDuration: action.buffDuration,
      preventsBuffs: ["frostEffect"],
    }];

    if (!unit.owner || !unit.prefab || !unit.position) return;

    const facing = unit.facing ?? DEFAULT_FACING;
    const angleOffset = (Math.random() - 0.5) * (Math.PI / 3); // 60 degrees total range
    const moveAngle = facing + angleOffset;

    const walkDistance = 5;
    const targetX = unit.position.x + Math.cos(moveAngle) * walkDistance;
    const targetY = unit.position.y + Math.sin(moveAngle) * walkDistance;

    newUnit(
      unit.owner,
      unit.prefab,
      unit.position.x,
      unit.position.y,
      {
        isMirror: true,
        facing,
        requiresPathing: PATHING_SOLID,
        blocksPathing: PATHING_NONE,
        actions: unit.actions?.filter((a) =>
          a.type === "target" && a.order === "move"
        ),
        order: { type: "walk", target: { x: targetX, y: targetY } },
        buffs: [{
          remainingDuration: action.buffDuration,
          totalDuration: action.buffDuration,
          expiration: "DodgeImage",
        }],
      },
    );

    return true;
  },
} satisfies OrderDefinition;
