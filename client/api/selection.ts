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

  const primaryUnits: Entity[] = [];
  for (const entity of app.entities) {
    if (
      entity.owner === localPlayer.id &&
      (entity.prefab === "sheep" || entity.prefab === "wolf" ||
        entity.prefab === "spirit")
    ) {
      primaryUnits.push(entity);
    }
  }

  if (primaryUnits.length === 0) return;

  // Find the first selected primary unit
  let currentIndex = -1;
  for (const selectedEntity of selection) {
    const index = primaryUnits.findIndex((unit) =>
      unit.id === selectedEntity.id
    );
    if (index !== -1) {
      currentIndex = index;
      break;
    }
  }

  // Find the next unselected primary unit after the current one
  if (currentIndex !== -1) {
    for (let i = 1; i < primaryUnits.length; i++) {
      const nextIndex = (currentIndex + i) % primaryUnits.length;
      const nextUnit = primaryUnits[nextIndex];
      if (!nextUnit.selected) {
        selectEntity(nextUnit);
        return;
      }
    }
  }

  // If all primary units are selected or no primary unit is selected, select the first one
  selectEntity(primaryUnits[0]);
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
