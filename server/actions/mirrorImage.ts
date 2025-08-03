import { DEFAULT_FACING, MIRROR_SEPARATION } from "../../shared/constants.ts";
import { Entity } from "../../shared/types.ts";
import { currentApp } from "../contexts.ts";
import { UnitDeathEvent } from "../ecs.ts";
import { lookup } from "../systems/lookup.ts";

export const handleMirrorImage = (unit: Entity) => {
  if (!unit.position) return;

  // Find the mirror image action to get its cast duration
  const mirrorImageAction = unit.actions?.find(
    (action) => "order" in action && action.order === "mirrorImage",
  );
  if (!mirrorImageAction) return;

  // Get mana cost and check if unit has enough mana
  const manaCost = mirrorImageAction.manaCost ?? 0;
  if (manaCost > 0) {
    if ((unit.mana ?? 0) < manaCost) return; // Not enough mana
    unit.mana = (unit.mana ?? 0) - manaCost; // Subtract mana cost
  }

  // Get cast duration from action, default to 0 if not specified
  const castDuration = mirrorImageAction.castDuration ?? 0;

  if (unit.mirrors) {
    for (const mirrorId of unit.mirrors) {
      const mirror = lookup(mirrorId);
      if (mirror) {
        currentApp().dispatchTypedEvent(
          "unitDeath",
          new UnitDeathEvent(mirror, undefined),
        );
      }
    }
    delete unit.mirrors;
  }

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
    remaining: castDuration,
    info: { type: "mirrorImage", positions: [pos1, pos2] },
  };
  delete unit.queue;
};
