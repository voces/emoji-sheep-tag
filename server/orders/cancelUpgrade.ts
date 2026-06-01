import { OrderOverride } from "./types.ts";
import { changePrefab } from "../api/unit.ts";

export const cancelUpgradeOrder = {
  onCastComplete: (unit) => {
    if (!unit.position || !unit.owner) return false;

    const cancelAction = unit.actions?.find((a) =>
      a.type === "auto" && a.order === "cancel-upgrade"
    );

    if (!cancelAction || cancelAction.type !== "auto" || !cancelAction.prefab) {
      return false;
    }

    changePrefab(unit, cancelAction.prefab);

    if (typeof unit.progress === "number") delete unit.progress;

    return true;
  },
} satisfies OrderOverride;
