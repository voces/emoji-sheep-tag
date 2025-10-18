import { OrderDefinition } from "./types.ts";
import { refundEntity } from "../api/unit.ts";

export const selfDestructOrder = {
  id: "selfDestruct",

  onIssue: () => {
    // TODO: support queuing, but right now things that support self destruct
    // can't do anything else, so queueing does nothing
    return "immediate";
  },

  onCastComplete: (unit) => {
    refundEntity(unit);
    unit.lastAttacker = null;
    if (typeof unit.health === "number") unit.health = 0;
    return true;
  },
} satisfies OrderDefinition;
