import { Entity } from "../ecs.ts";
import { camera } from "../graphics/three.ts";
import {
  foxes,
  getPrimaryUnit,
  mirrors,
  selection,
} from "../systems/autoSelect.ts";
import { closeMenusForUnit } from "@/vars/menuState.ts";
import { focusGroup } from "./camera.ts";
import { getEntitiesInRange } from "../systems/kd.ts";

export const DOUBLE_CLICK_SELECTION_RADIUS = 6;

export const selectEntitiesByPrefabInRadius = (
  origin: Entity,
  radius: number,
  additive: boolean,
) => {
  if (!origin.prefab || !origin.position) return;

  const nearbyMatchingEntities = getEntitiesInRange(
    origin.position.x,
    origin.position.y,
    radius,
  ).map((entity) => entity as Entity).filter((entity) =>
    !!entity.prefab &&
    !!entity.position &&
    entity.prefab === origin.prefab &&
    entity.owner === origin.owner &&
    !entity.hiddenByFog
  );

  if (!nearbyMatchingEntities.length) return;

  if (!additive) clearSelection();

  for (const entity of nearbyMatchingEntities) selectEntity(entity, false);
};

export const selectEntity = (entity: Entity, clearCurrentSelection = true) => {
  if (clearCurrentSelection) {
    // Close menus for units being deselected
    for (const deselectedEntity of selection) {
      if (entity === deselectedEntity) continue;
      closeMenusForUnit(deselectedEntity.id);
      delete (deselectedEntity as Entity).selected;
    }
  }
  entity.selected = true;
};

export const selectAllFoxes = () => {
  if (!foxes.size) return;

  if (foxes.every((f) => f.selected) && foxes.size === selection.size) {
    return focusGroup(foxes);
  }

  clearSelection();
  for (const fox of foxes) fox.selected = true;
};

export const selectAllMirrors = () => {
  if (!mirrors.size) return;

  if (mirrors.every((e) => e.selected) && mirrors.size === selection.size) {
    return focusGroup(mirrors);
  }

  clearSelection();
  for (const entity of mirrors) entity.selected = true;
};

/**
 * Select the primary unit (sheep, wolf, or spirit) owned by the local player
 */
export const selectPrimaryUnit = () => {
  const primaryUnit = getPrimaryUnit();
  if (primaryUnit) {
    if (primaryUnit.selected && primaryUnit.position && selection.size === 1) {
      camera.position.x = primaryUnit.position.x;
      camera.position.y = primaryUnit.position.y;
    }
    selectEntity(primaryUnit);
  }
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
