import { SystemEntity } from "jsr:@verit/ecs";
import { tempUnit } from "../../shared/api/unit.ts";
import {
  canSwing,
  distanceBetweenPoints,
  Point,
} from "../../shared/pathing/math.ts";
import { isPathingEntity } from "../../shared/pathing/util.ts";
import { Entity } from "../../shared/types.ts";
import { currentApp, lobbyContext } from "../contexts.ts";
import { data } from "../st/data.ts";
import {
  calcPath,
  pathable,
  pathingMap,
  updatePathing,
  withPathingMap,
} from "../systems/pathing.ts";
import { prefabs } from "../../shared/data.ts";
import { FOLLOW_DISTANCE } from "../../shared/constants.ts";
import { getEntitiesInRange } from "../systems/kd.ts";

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
    prefabs[type].completionTime
      ? { progress: INITIAL_BUILDING_PROGRESS }
      : undefined,
  );
  if (!isPathingEntity(temp)) {
    deductBuildGold(builder, type);
    return p.withoutEntity(builder, () => app.addEntity(temp));
  }

  // Make building if pathable
  const pathable = p.withoutEntity(builder, () => {
    if (!p.pathable(temp)) return false;
    deductBuildGold(builder, type);
    app.addEntity(temp);
    return true;
  });
  if (!pathable) return;

  // Handle translocation for Translocation Hut
  if (type === "translocationHut" && builder.position && temp.position) {
    // Calculate the vector from structure center to builder
    const dx = builder.position.x - temp.position.x;
    const dy = builder.position.y - temp.position.y;

    // Convert to polar coordinates and add 180 degrees
    const distance = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
    const angle = Math.atan2(dy, dx) + Math.PI; // Add 180 degrees (π radians)

    // Calculate new position on opposite side
    const newX = temp.position.x + distance * Math.cos(angle);
    const newY = temp.position.y + distance * Math.sin(angle);

    // Move the builder to the new position
    builder.position = { x: newX, y: newY };
  }

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

  const path = calcPath(mover, "x" in target ? target : target.id, {
    distanceFromTarget: "x" in target ? undefined : FOLLOW_DISTANCE,
  }).slice(1);
  if (!path.length) return false;

  mover.order = {
    type: "walk",
    ...("x" in target ? { target } : { targetId: target.id }),
    path,
  };

  return true;
};

const isReachableTarget = (attacker: Entity, target: Entity) => {
  if (!attacker.position) return false;

  // If within attack range...
  if (canSwing(attacker, target)) return true;

  // Cannot walk
  if (!attacker.movementSpeed) return false;

  const path = calcPath(attacker, "id" in target ? target.id : target, {
    mode: "attack",
  }).slice(1);

  return path.length > 0 &&
    (path.at(-1)?.x !== attacker.position.x ||
      path.at(-1)?.y !== attacker.position.y);
};

export const acquireTarget = (e: Entity) => {
  const pos = e.position;
  if (!pos) return;
  return getEntitiesInRange(pos.x, pos.y, 10)
    .filter((e2) => isEnemy(e, e2))
    .map((e2) => [e2, distanceBetweenPoints(pos, e2.position)] as const)
    .sort((a, b) => {
      if (a[0].prefab === "sheep") {
        if (b[0].prefab !== "sheep") return -1;
      } else if (b[0].prefab === "sheep") return 1;
      return a[1] - b[1];
    }).find(([e2]) => isReachableTarget(e, e2))?.[0];
};

export const orderAttack = (
  attacker: Entity,
  target: Entity | Point,
): boolean => {
  updatePathing(attacker, 1);
  if (!attacker.attack || !attacker.position) return false;

  if ("id" in target) {
    if (!target.position) return false;

    // If within attack range..
    if (canSwing(attacker, target)) {
      // Otherwise attack immediately
      delete attacker.queue;
      attacker.order = { type: "attack", targetId: target.id };
      return true;
    }

    // If not in range and no movement, abort
    if (!attacker.movementSpeed) return false;

    delete attacker.queue;
    attacker.order = { type: "attack", targetId: target.id };
    return true;
  }

  // TODO: check if nearby target in range
  if (!attacker.movementSpeed) return false;

  delete attacker.queue;
  attacker.order = { type: "attackMove", target };
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
export const computeBuildDistance = (prefab: string) =>
  ABSOLUTE + ((prefabs[prefab].radius ?? 0) * RELATIVE);

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

  delete builder.queue;
  builder.order = { type: "build", x, y, unitType: type };
  return true;
};

export const isAlive = (unit: Entity) => {
  if (!currentApp().entities.has(unit)) return false;
  return typeof unit.health !== "number" || unit.health > 0;
};

const deductBuildGold = (builder: Entity, type: string) => {
  if (!builder.owner) return;

  const buildAction = builder.actions?.find((a) =>
    a.type === "build" && a.unitType === type
  );
  const goldCost =
    (buildAction?.type === "build" ? buildAction.goldCost : undefined) ?? 0;

  if (goldCost > 0) {
    const lobby = lobbyContext.context;
    const ownerClient = lobby?.round
      ? Array.from([...lobby.round.sheep, ...lobby.round.wolves]).find(
        (client) => client.id === builder.owner,
      )
      : undefined;

    if (
      ownerClient?.playerEntity && ownerClient.playerEntity.gold !== undefined
    ) {
      ownerClient.playerEntity.gold -= goldCost;
    }
  }
};
