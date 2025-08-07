import { Entity, UnitDataAction } from "../../shared/types.ts";
import { findActionByOrder } from "../util/actionLookup.ts";

export const handleFox = (unit: Entity, providedAction?: UnitDataAction) => {
  const action = providedAction ?? findActionByOrder(unit, "fox");
  if (!action) return;

  // Check if unit has enough mana (but don't consume it here - that happens in advanceCast)
  const manaCost = ("manaCost" in action ? action.manaCost : undefined) ?? 0;
  if (manaCost > 0) {
    if (!unit.mana || unit.mana < manaCost) return;
  }

  unit.order = {
    type: "cast",
    orderId: "fox",
    remaining: ("castDuration" in action ? action.castDuration : undefined) ??
      0,
  };
};
