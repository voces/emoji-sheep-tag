import { OrderOverride } from "./types.ts";
import { practiceModeActions } from "@/shared/data.ts";

const PRACTICE_ENEMY = "practice-enemy";

/**
 * Practice mode lets a player hand one of their units to the practice enemy
 * and take it back. Each direction swaps its own action for the opposite one.
 */
const transferPracticeControl = (toEnemy: boolean) => {
  const fromOrder = toEnemy ? "giveToEnemy" : "reclaimFromEnemy";
  const replacement = toEnemy
    ? practiceModeActions.reclaimFromEnemy
    : practiceModeActions.giveToEnemy;

  return {
    onIssue: (unit) => {
      if (!unit.trueOwner) return "failed";
      if ((unit.owner === PRACTICE_ENEMY) === toEnemy) return "failed";

      unit.owner = toEnemy ? PRACTICE_ENEMY : unit.trueOwner;

      if (unit.actions) {
        unit.actions = unit.actions.map((action) =>
          action.type === "auto" && action.order === fromOrder
            ? replacement
            : action
        );
      }

      if (!toEnemy && unit.order?.type === "attack") unit.order = null;

      return "immediate";
    },
  } satisfies OrderOverride;
};

export const giveToEnemyOrder = transferPracticeControl(true);
export const reclaimFromEnemyOrder = transferPracticeControl(false);
