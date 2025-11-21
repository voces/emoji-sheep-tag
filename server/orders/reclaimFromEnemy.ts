import { OrderDefinition } from "./types.ts";
import { practiceModeActions } from "@/shared/data.ts";

export const reclaimFromEnemyOrder = {
  id: "reclaimFromEnemy",

  onIssue: (unit) => {
    // Only works if unit has a trueOwner (practice mode)
    if (!unit.trueOwner) return "failed";

    // Can't reclaim if not owned by practice-enemy
    if (unit.owner !== "practice-enemy") return "failed";

    // Restore ownership to trueOwner
    unit.owner = unit.trueOwner;

    // Swap "Reclaim" action back to "Give to Enemy" action
    if (unit.actions) {
      unit.actions = unit.actions.map((action) =>
        action.type === "auto" && action.order === "reclaimFromEnemy"
          ? practiceModeActions.giveToEnemy
          : action
      );
    }

    return "immediate";
  },
} satisfies OrderDefinition;
