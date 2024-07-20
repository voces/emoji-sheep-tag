import { unitData } from "../../shared/data.ts";
import { PathingEntity } from "../../shared/pathing/types.ts";
import { Entity } from "../../shared/types.ts";
import { currentApp } from "../contexts.ts";
import {
  isPathingEntity,
  pathingMap,
  updatePathing,
} from "../systems/pathing.ts";

export const build = (builder: Entity, type: string, x: number, y: number) => {
  const app = currentApp();
  if (!isPathingEntity(builder)) return;

  const p = pathingMap();

  const temp = tempUnit(builder.owner!, type, x, y);
  if (!isPathingEntity(temp)) {
    return p.withoutEntity(builder, () => app.add(temp));
  }

  // Make building if pathable
  const pathable = p.withoutEntity(
    builder as PathingEntity,
    () => {
      if (!p.pathable(temp as PathingEntity)) return false;
      app.add(temp);
      return true;
    },
  );
  if (!pathable) return;

  // Relocate entity if position not valid
  updatePathing(builder);
};

export const tempUnit = (
  owner: string,
  type: string,
  x: number,
  y: number,
): Entity => ({
  id: "",
  unitType: type,
  owner,
  position: { x, y },
  ...unitData[type],
});

export const newUnit = (owner: string, type: string, x: number, y: number) =>
  currentApp().add(tempUnit(owner, type, x, y));
