import { Entity } from "../ecs.ts";
import { selection } from "../systems/autoSelect.ts";

export const selectEntity = (entity: Entity, clearCurrentSelection = true) => {
  if (clearCurrentSelection) {
    for (const entity of selection) delete (entity as Entity).selected;
  }
  entity.selected = true;
};
