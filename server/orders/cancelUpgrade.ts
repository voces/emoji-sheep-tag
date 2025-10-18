import { OrderDefinition } from "./types.ts";
import { changePrefab, refundEntity } from "../api/unit.ts";

export const cancelUpgradeOrder = {
  id: "cancel-upgrade",

  onIssue: (unit) => {
    const cancelAction = unit.actions?.find((a) =>
      a.type === "auto" && a.order === "cancel-upgrade"
    );

    if (!cancelAction || cancelAction.type !== "auto" || !cancelAction.prefab) {
      return "failed";
    }

    return "immediate";
  },

  onCastComplete: (unit) => {
    if (!unit.position || !unit.owner) return false;

    const cancelAction = unit.actions?.find((a) =>
      a.type === "auto" && a.order === "cancel-upgrade"
    );

    if (!cancelAction || cancelAction.type !== "auto" || !cancelAction.prefab) {
      return false;
    }

    refundEntity(unit);
    changePrefab(unit, cancelAction.prefab);

    if (typeof unit.progress === "number") delete unit.progress;

    return true;
  },
} satisfies OrderDefinition;
