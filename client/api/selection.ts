import { Entity } from "../ecs.ts";
import { selection } from "../systems/autoSelect.ts";
import { closeMenusForUnit } from "../ui/vars/menuState.ts";

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
