import { App } from "jsr:@verit/ecs";
import { Entity } from "../../shared/types.ts";
import { lookup } from "./lookup.ts";
import {
  distanceBetweenPoints,
  squaredDistanceBetweenPoints,
} from "../../shared/pathing/math.ts";
import { calcPath, pathable } from "./pathing.ts";

export const addUnitMovementSystem = (app: App<Entity>) =>
  app.addSystem({
    props: ["moving", "position"],
    updateChild: (e, delta) => {
      // If not moving or can't move, clear it
      if (
        !e.movementSpeed || e.action?.type !== "walk" ||
        e.action.path.length === 0
      ) {
        if (e.action?.type === "walk") delete e.action;
        delete (e as Entity).moving;
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
        delete (e as Entity).moving;
        delete e.action;
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
          delete (e as Entity).moving;
          delete e.action;
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

      console.log(last, target, p, e.position);
    },
  });
