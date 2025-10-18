import { Entity } from "@/shared/types.ts";
import { findAction } from "../../util/actionLookup.ts";
import { deductPlayerGold, getPlayerGold } from "../../api/player.ts";
import { prefabs } from "@/shared/data.ts";
import { UPGRADE_REFUND_RATE } from "@/shared/constants.ts";
import { changePrefab } from "../../api/unit.ts";

export const beginUpgrade = (e: Entity) => {
  const { position } = e;
  if (!position) return;

  const prefabId = e.order?.type === "upgrade" ? e.order.prefab : undefined;
  if (!prefabId) return;

  const action = findAction(
    e,
    (a) => a.type === "upgrade" && a.prefab === prefabId,
  );
  if (!action) return;

  let goldCost: number | undefined = undefined;
  if (e.owner && action.goldCost) {
    goldCost = action.goldCost;
    if (getPlayerGold(e.owner) < action.goldCost) return;
    else deductPlayerGold(e.owner, action.goldCost);
  }

  const upgradeTime =
    ("castDuration" in action ? action.castDuration : undefined) ??
      prefabs[prefabId]?.completionTime ?? 0;

  const prevPrefab = e.prefab;

  e.progress = 0;
  e.completionTime = upgradeTime;

  changePrefab(e, prefabId);

  e.actions = [{
    type: "auto",
    order: "cancel-upgrade",
    name: "Cancel upgrade",
    icon: "stop",
    prefab: prevPrefab,
    binding: ["Backquote"],
    goldCost: goldCost ? -goldCost * UPGRADE_REFUND_RATE : undefined,
    canExecuteWhileConstructing: true,
  }, ...(e.actions ?? [])];

  delete e.order;
};
