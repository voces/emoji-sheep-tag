import { SystemEntity } from "jsr:@verit/ecs";
import { tempUnit } from "../../shared/api/unit.ts";
import {
  canSwing,
  distanceBetweenPoints,
  Point,
} from "../../shared/pathing/math.ts";
import { isPathingEntity } from "../../shared/pathing/util.ts";
import { Entity } from "../../shared/types.ts";
import { currentApp } from "../contexts.ts";
import { data } from "../st/data.ts";
import {
  calcPath,
  pathable,
  pathingMap,
  updatePathing,
  withPathingMap,
} from "../systems/pathing.ts";
import { unitData } from "../../shared/data.ts";

const INITIAL_BUILDING_PROGRESS = 0.1;

export const build = (builder: Entity, type: string, x: number, y: number) => {
  const app = currentApp();
  if (!isPathingEntity(builder)) return;

  const p = pathingMap();

  const temp = tempUnit(
    builder.owner!,
    type,
    x,
    y,
    unitData[type].completionTime
      ? { progress: INITIAL_BUILDING_PROGRESS }
      : undefined,
  );
  if (!isPathingEntity(temp)) {
    return p.withoutEntity(builder, () => app.addEntity(temp));
  }

  // Make building if pathable
  const pathable = p.withoutEntity(builder, () => {
    if (!p.pathable(temp)) return false;
    app.addEntity(temp);
    return true;
  });
  if (!pathable) return;

  // Relocate entity if position not valid
  app.enqueue(() => updatePathing(builder));

  return temp;
};

export const newUnit = (owner: string, type: string, x: number, y: number) =>
  currentApp().addEntity(tempUnit(owner, type, x, y));

export const isEnemy = (source: Entity, target: Entity) => {
  const sourceIsSheep = data.sheep.some((s) => s.client.id === source.owner);
  const targetIsSheep = data.sheep.some((s) => s.client.id === target.owner);
  return sourceIsSheep !== targetIsSheep;
};

export const isAlly = (source: Entity, target: Entity) =>
  !isEnemy(source, target);

export const orderMove = (mover: Entity, target: Entity | Point): boolean => {
  updatePathing(mover, 1);

  if (!mover.movementSpeed || !mover.radius) return false;

  const targetPos = "x" in target ? target : target.position;
  if (!targetPos) return false;

  const path = calcPath(mover, "x" in target ? target : target.id).slice(1);
  if (!path.length) return false;

  mover.action = {
    type: "walk",
    target: "x" in target ? target : path.at(-1)!,
    path,
  };

  return true;
};

export const orderAttack = (attacker: Entity, target: Entity): boolean => {
  updatePathing(attacker, 1);

  if (!attacker.attack || !attacker.position || !target.position) return false;

  // If within attack range..
  if (canSwing(attacker, target)) {
    // Otherwise attack immediately
    delete attacker.queue;
    attacker.action = { type: "attack", target: target.id };
    return true;
  }

  // If not in range and no movement, abort
  if (!attacker.movementSpeed) return false;

  const path = calcPath(attacker, target.id, { mode: "attack" }).slice(1);
  // No path possible
  if (
    !path.length || (path.at(-1)?.x === attacker.position.x &&
      path.at(-1)?.y === attacker.position.y)
  ) return false;

  attacker.action = {
    type: "walk",
    target: target.id,
    path,
    attacking: true,
    // distanceFromTarget: attacker.attack.range,
  };
  attacker.queue = [{ type: "attack", target: target.id }];
  return true;
};

// Minimized relative and maximized absolute such that diagonal tinies cannot
// be built but semi-diagonal stacks can be:
// ..FF
// ..FF
// .oSS
// FFFF
// FF
// The target distance for semi-diagonal stacks is √10/4, while for diagonal
// tinies it is √½
// We can compute a minimum RELATIVE from √½-0.25x = √10/4-0.5x
//                                               x = √10-2√2
// We can then compute ABSOLUTE from √½-0.25*RELATIVE
const RELATIVE = 0.3340;
const ABSOLUTE = 0.6236;
export const computeBuildDistance = (unitType: string) =>
  ABSOLUTE + ((unitData[unitType].radius ?? 0) * RELATIVE);

export const orderBuild = (
  builder: Entity,
  type: string,
  x: number,
  y: number,
): boolean => {
  updatePathing(builder, 1);

  // Invalid build order
  if (
    !builder.owner ||
    !builder.position || !builder.radius ||
    !builder.actions?.some((a) => a.type === "build" && a.unitType === type)
  ) return false;

  // Validate pathable
  const temp = tempUnit(builder.owner, type, x, y);
  if (
    !withPathingMap((pm) =>
      pm.withoutEntity(
        builder as SystemEntity<Entity, "position" | "radius">,
        () => pathable(temp),
      )
    )
  ) return false;

  // Check if walking required
  const buildDistance = computeBuildDistance(type);
  if (distanceBetweenPoints(builder.position, { x, y }) <= buildDistance) {
    builder.action = { type: "build", unitType: type, x, y };
    return true;
  }

  // Validate can walk there
  const path = calcPath(builder, { x, y }, {
    distanceFromTarget: buildDistance,
  }).slice(1);

  if (!path.length) return false;

  builder.action = {
    type: "walk",
    target: { x, y },
    path,
    distanceFromTarget: buildDistance,
  };
  builder.queue = [{ type: "build", x, y, unitType: type }];
  return true;
};

export const isAlive = (unit: Entity) => {
  if (!currentApp().entities.has(unit)) return false;
  return typeof unit.health !== "number" || unit.health > 0;
};
