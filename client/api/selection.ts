import { app } from "../ecs.ts";
import { Entity } from "../ecs.ts";
import { selection } from "../systems/autoSelect.ts";
import { closeMenusForUnit } from "@/vars/menuState.ts";
import { getLocalPlayer } from "@/vars/players.ts";

export const selectEntity = (entity: Entity, clearCurrentSelection = true) => {
  if (clearCurrentSelection) {
    // Close menus for units being deselected
    for (const deselectedEntity of selection) {
      closeMenusForUnit(deselectedEntity.id);
      delete (deselectedEntity as Entity).selected;
    }
  }
  entity.selected = true;
};

/**
 * Select all units of a specific type owned by the local player
 */
export const selectAllUnitsOfType = (unitType: string) => {
  const localPlayer = getLocalPlayer();
  if (!localPlayer) return;

  const units: Entity[] = [];
  for (const entity of app.entities) {
    if (entity.owner === localPlayer.id && entity.prefab === unitType) {
      units.push(entity);
    }
  }

  if (units.length > 0) {
    clearSelection();
    for (const entity of units) entity.selected = true;
  }
};

/**
 * Select all mirror images owned by the local player
 */
export const selectAllMirrors = () => {
  const localPlayer = getLocalPlayer();
  if (!localPlayer) return;

  const mirrorEntities: Entity[] = [];
  for (const entity of app.entities) {
    if (entity.owner === localPlayer.id && entity.isMirror === true) {
      mirrorEntities.push(entity);
    }
  }

  if (mirrorEntities.length > 0) {
    clearSelection();
    for (const entity of mirrorEntities) entity.selected = true;
  }
};

/**
 * Select the primary unit (sheep or wolf) owned by the local player
 */
export const selectPrimaryUnit = () => {
  const localPlayer = getLocalPlayer();
  if (!localPlayer) return;

  let ownedUnit: Entity | undefined;
  for (const entity of app.entities) {
    if (
      entity.owner === localPlayer.id &&
      (entity.prefab === "sheep" || entity.prefab === "wolf")
    ) {
      ownedUnit = entity;
      break;
    }
  }

  if (ownedUnit) selectEntity(ownedUnit);
};

/**
 * Clear the current selection
 */
export const clearSelection = () => {
  for (const entity of selection) {
    closeMenusForUnit(entity.id);
    delete (entity as Entity).selected;
  }
};
