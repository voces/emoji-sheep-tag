import { tempUnit } from "../../shared/api/unit.ts";
import { unitData } from "../../shared/data.ts";
import { isPathingEntity } from "../../shared/pathing/util.ts";
import { Entity } from "../../shared/types.ts";
import { currentApp } from "../contexts.ts";
import { data } from "../st/data.ts";
import { pathingMap, updatePathing } from "../systems/pathing.ts";

export const build = (builder: Entity, type: string, x: number, y: number) => {
  const app = currentApp();
  if (!isPathingEntity(builder)) return;

  const p = pathingMap();

  const temp = tempUnit(builder.owner!, type, x, y);
  if (!isPathingEntity(temp)) {
    return p.withoutEntity(builder, () => app.add(temp));
  }

  // Make building if pathable
  const pathable = p.withoutEntity(builder, () => {
    if (!p.pathable(temp)) return false;
    app.add(temp);
    return true;
  });
  if (!pathable) return;

  // Relocate entity if position not valid
  updatePathing(builder);
};

export const newUnit = (owner: string, type: string, x: number, y: number) =>
  currentApp().add(tempUnit(owner, type, x, y));

export const isEnemy = (source: Entity, target: Entity) => {
  const sourceIsSheep = data.sheep.some((s) => s.client.id === source.owner);
  const targetIsSheep = data.sheep.some((s) => s.client.id === target.owner);
  return sourceIsSheep !== targetIsSheep;
};

export const isAlly = (source: Entity, target: Entity) =>
  !isEnemy(source, target);
