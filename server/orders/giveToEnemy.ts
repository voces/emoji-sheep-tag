import { OrderDefinition } from "./types.ts";
import { practiceModeActions } from "@/shared/data.ts";

export const giveToEnemyOrder = {
  id: "giveToEnemy",

  onIssue: (unit) => {
    // Only works if unit has a trueOwner (practice mode)
    if (!unit.trueOwner) return "failed";

    // Can't give to enemy if already owned by practice-enemy
    if (unit.owner === "practice-enemy") return "failed";

    // Transfer ownership to practice-enemy
    unit.owner = "practice-enemy";

    // Swap "Give to Enemy" action with "Reclaim" action
    if (unit.actions) {
      unit.actions = unit.actions.map((action) =>
        action.type === "auto" && action.order === "giveToEnemy"
          ? practiceModeActions.reclaimFromEnemy
          : action
      );
    }

    return "immediate";
  },
} satisfies OrderDefinition;
