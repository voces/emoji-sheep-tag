import { App } from "jsr:@verit/ecs";
import { Entity } from "../../shared/types.ts";
import { lookup } from "./lookup.ts";
import {
  distanceBetweenEntities,
  distanceBetweenPoints,
} from "../../shared/pathing/math.ts";
import { calcPath } from "./pathing.ts";

export const addUnitMovementSystem = (app: App<Entity>) => {
  // Motion tweening
  app.addSystem({
    props: ["isMoving", "position"],
    updateChild: (e, delta) => {
      console.debug("tween");
      // If not moving or can't move, clear it
      if (
        !e.movementSpeed || e.action?.type !== "walk" ||
        e.action.path.length === 0
      ) {
        console.debug("tween stop 1");
        if (e.action?.type === "walk") delete e.action;
        delete (e as Entity).isMoving;
        return;
      }

      let target = typeof e.action.target === "string"
        ? lookup(e.action.target).position
        : e.action.target;

      if (
        !target ||
        (typeof e.action.target === "string"
            ? distanceBetweenEntities(e, lookup(e.action.target))
            : distanceBetweenPoints(target, e.position)) <=
          (e.action.distanceFromTarget ?? 0)
      ) {
        console.debug("tween stop 2");
        delete (e as Entity).isMoving;
        if (
          typeof e.action.target !== "string" ||
          !lookup(e.action.target).movementSpeed ||
          e.action.attacking
        ) delete e.action;
        return;
      }

      target = e.action.path[0];

      let movement = e.movementSpeed * delta;

      // Tween along movement
      let remaining = distanceBetweenPoints(target, e.position);
      let p = movement / remaining;
      console.debug("s1", e.position, e.action.path, p);
      let last = e.position;
      while (p > 1) {
        if (e.action.path.length === 1) {
          e.position = { ...target };
          console.debug("at end, breaking", e.position);
          delete (e as Entity).isMoving;
          if (
            typeof e.action.target !== "string" ||
            !lookup(e.action.target).movementSpeed ||
            e.action.attacking
          ) {
            console.debug("clearing action", e.queue);
            delete e.action;
          } else console.debug("not clearing");
          return;
        }

        movement -= remaining;
        target = e.action.path[1];
        last = e.action.path[0];
        e.action = { ...e.action, path: e.action.path.slice(1) };
        remaining = distanceBetweenPoints(target, last);
        p = movement / remaining;
        console.debug("s2", last, e.action.path, p);
      }

      console.debug(
        "update",
        p,
        p < 1
          ? {
            x: last.x * (1 - p) + target.x * p,
            y: last.y * (1 - p) + target.y * p,
          }
          : {
            x: target.x,
            y: target.y,
          },
      );
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
    props: ["isMoving"],
    update: () => {
      let offset = -1;
      for (const e of sys.entities) {
        console.debug("isMoving", e.id);
        if (e.action?.type !== "walk") {
          console.debug("clearing from recalc");
          delete (e as Entity).isMoving;
          return;
        }
        offset++;
        if (
          e.action.type !== "walk" ||
          (counter + offset) % (typeof e.action.target === "string" ? 3 : 17)
        ) continue;
        console.debug("movement system calc path", e.action, e.queue);
        const newPath = calcPath(
          e,
          e.action.target,
          e.action.attacking ? "attack" : undefined,
        );
        console.debug("calc path", {
          newPath,
          position: e.position,
          target: typeof e.action.target === "string"
            ? lookup(e.action.target).position
            : e.action.target,
        });
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
