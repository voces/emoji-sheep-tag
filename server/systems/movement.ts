import { App } from "jsr:@verit/ecs";
import { Entity } from "../../shared/types.ts";
import { lookup } from "./lookup.ts";
import {
  distanceBetweenPoints,
  squaredDistanceBetweenPoints,
} from "../../shared/pathing/math.ts";
import { calcPath } from "./pathing.ts";

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

      let target = typeof e.action.target === "string"
        ? lookup(e.action.target).position
        : e.action.target;

      if (
        !target ||
        squaredDistanceBetweenPoints(target, e.position) <=
          (e.action.distanceFromTarget ?? 0) ** 2
      ) {
        delete (e as Entity).isMoving;
        if (typeof e.action.target !== "string") delete e.action;
        return;
      }

      target = e.action.path[0];

      let movement = e.movementSpeed * delta;

      // Tween along movement
      let remaining = distanceBetweenPoints(target, e.position);
      let p = movement / remaining;
      let last = e.position;
      while (p > 1) {
        if (e.action.path.length === 1) {
          e.position = { ...target };
          delete (e as Entity).isMoving;
          if (typeof e.action.target !== "string") delete e.action;
          break;
        }

        movement -= remaining;
        target = e.action.path[1];
        last = e.action.path[0];
        e.action = { ...e.action, path: e.action.path.slice(1) };
        remaining = distanceBetweenPoints(target, last);
        p = movement / remaining;
      }

      e.position = p < 1
        ? {
          x: last.x * (1 - p) + target.x * p,
          y: last.y * (1 - p) + target.y * p,
        }
        : {
          x: target.x,
          y: target.y,
        };
    },
  });

  // Recalculate paths regularly
  let counter = 0;
  const sys = app.addSystem({
    props: ["action"],
    update: () => {
      let offset = -1;
      for (const e of sys.entities) {
        offset++;
        if (
          e.action.type !== "walk" ||
          (counter + offset) % (typeof e.action.target === "string" ? 3 : 17)
        ) continue;
        const newPath = calcPath(e, e.action.target);
        if (!newPath.length) return delete (e as Entity).action;
        e.action = {
          ...e.action,
          path: newPath,
        };
      }
      counter++;
    },
  });
};
