import { DEFAULT_FACING, MIRROR_SEPARATION } from "../../shared/constants.ts";
import { Entity } from "../../shared/types.ts";
import { findActionByOrder } from "../util/actionLookup.ts";

export const handleMirrorImage = (unit: Entity) => {
  if (!unit.position) return;

  // Find the mirror image action to get its cast duration
  const mirrorImageAction = findActionByOrder(unit, "mirrorImage");
  if (!mirrorImageAction) return;

  // Check if unit has enough mana (but don't consume it here - that happens in advanceCast)
  const manaCost =
    ("manaCost" in mirrorImageAction
      ? mirrorImageAction.manaCost
      : undefined) ?? 0;
  if (manaCost > 0) {
    if ((unit.mana ?? 0) < manaCost) return; // Not enough mana
  }

  // Get cast duration from action, default to 0 if not specified
  const castDuration =
    ("castDuration" in mirrorImageAction
      ? mirrorImageAction.castDuration
      : undefined) ?? 0;


  const angle1 = (unit.facing ?? DEFAULT_FACING) + Math.PI / 2;
  const angle2 = (unit.facing ?? DEFAULT_FACING) - Math.PI / 2;
  let pos1 = {
    x: unit.position.x + Math.cos(angle1) * MIRROR_SEPARATION,
    y: unit.position.y + Math.sin(angle1) * MIRROR_SEPARATION,
  };
  let pos2 = {
    x: unit.position.x + Math.cos(angle2) * MIRROR_SEPARATION,
    y: unit.position.y + Math.sin(angle2) * MIRROR_SEPARATION,
  };

  if (Math.random() < 0.5) [pos1, pos2] = [pos2, pos1];

  unit.order = {
    type: "cast",
    orderId: "mirrorImage",
    remaining: castDuration,
    positions: [pos1, pos2],
  };
  delete unit.queue;
};
