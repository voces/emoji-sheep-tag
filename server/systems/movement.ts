import { App } from "jsr:@verit/ecs";
import { Entity } from "../../shared/types.ts";
import { lookup } from "./lookup.ts";
import {
  distanceBetweenEntities,
  distanceBetweenPoints,
} from "../../shared/pathing/math.ts";
import { calcPath, pathable, pathingMap } from "./pathing.ts";

const repath = (e: Entity) => {
  if (e.action?.type !== "walk") return;
  if (e.action.attacking && typeof e.action.target === "string") {
    const target = lookup(e.action.target);
    if (
      target && distanceBetweenEntities(e, target) <= (e.attack?.range ?? 0)
    ) {
      return delete (e as Entity).action;
    }
  }
  let newPath = calcPath(
    e,
    e.action.target,
    { mode: e.action.attacking ? "attack" : undefined },
  );
  if (
    newPath.length === e.action.path.length &&
    e.action.path.every((p, i) => p.x === newPath[i].x && p.y === newPath[i].y)
  ) {
    newPath = calcPath(
      e,
      e.action.target,
      {
        mode: e.action.attacking ? "attack" : undefined,
        removeMovingEntities: false,
      },
    );
  }
  if (newPath.length < 1) return delete (e as Entity).action;
  e.action = {
    ...e.action,
    path: newPath,
  };
};

export const addUnitMovementSystem = (app: App<Entity>) => {
  // Motion tweening
  app.addSystem({
    props: ["isMoving", "position"],
    updateChild: (e, delta) => {
      // If not moving or can't move, clear it
      if (
        !e.movementSpeed || e.action?.type !== "walk" ||
        e.action.path.length === 0
      ) {
        if (e.action?.type === "walk") delete e.action;
        delete (e as Entity).isMoving;
        return;
      }

      let targetEntity = typeof e.action.target === "string"
        ? lookup(e.action.target)
        : { position: e.action.target };

      if (!targetEntity) {
        if (e.action?.type === "walk") delete e.action;
        delete (e as Entity).isMoving;
        return;
      }

      if (
        !targetEntity ||
        ("id" in targetEntity
            ? distanceBetweenEntities(e, targetEntity)
            : distanceBetweenPoints(targetEntity.position, e.position)) <=
          (e.action.distanceFromTarget ?? 0)
      ) {
        delete (e as Entity).isMoving;
        if (
          !("id" in targetEntity) ||
          !targetEntity.movementSpeed ||
          e.action.attacking
        ) delete e.action;
        return;
      }

      let target = e.action.path[0];

      let movement = e.movementSpeed * delta;

      // Tween along movement
      let remaining = distanceBetweenPoints(target, e.position);
      let p = movement / remaining;
      let last = e.position;
      while (p > 1) {
        if (e.action.path.length === 1) {
          if (!pathable(e, target)) return repath(e);
          e.position = { ...target };
          delete (e as Entity).isMoving;
          if (
            !("id" in targetEntity) ||
            !targetEntity.movementSpeed ||
            e.action.attacking
          ) delete e.action;
          return;
        }

        movement -= remaining;
        target = e.action.path[1];
        last = e.action.path[0];
        e.action = { ...e.action, path: e.action.path.slice(1) };
        remaining = distanceBetweenPoints(target, last);
        p = movement / remaining;
      }

      const newPosition = p < 1
        ? {
          x: last.x * (1 - p) + target.x * p,
          y: last.y * (1 - p) + target.y * p,
        }
        : {
          x: target.x,
          y: target.y,
        };
      if (!pathable(e, newPosition)) return repath(e);
      e.position = newPosition;
    },
  });

  // Recalculate paths regularly
  let counter = 0;
  const sys = app.addSystem({
    props: ["isMoving"],
    update: () => {
      let offset = -1;
      for (const e of sys.entities) {
        if (e.action?.type !== "walk") {
          delete (e as Entity).isMoving;
          return;
        }
        offset++;
        if (
          e.action.type !== "walk" ||
          (counter + offset) % (typeof e.action.target === "string" ? 3 : 17)
        ) continue;
        repath(e);
      }
      counter++;
    },
  });
};
