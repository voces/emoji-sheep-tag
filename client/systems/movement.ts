import { app, Entity } from "../ecs.ts";
import { lookup } from "./lookup.ts";

// Movement system
app.addSystem({
  props: ["moving", "position"],
  updateChild: (e, delta) => {
    // If not moving or can't move, clear it
    if (
      !e.movementSpeed || e.action?.type !== "walk"
      // (e.action.target.x === e.position?.x) &&
      //   e.movement[e.movement.length - 1].y === e.position.y
    ) return delete (e as Entity).moving;

    let target = typeof e.action.target === "string"
      ? lookup[e.action.target]?.position
      : e.action.target;
    const distanceFromTarget = (e.action.distanceFromTarget ?? 0) ** 2;

    if (
      !target ||
      ((target.x - e.position.x) ** 2 + (target.y - e.position.y) ** 2) <=
        distanceFromTarget
    ) {
      delete (e as Entity).moving;
      delete (e as Entity).action;
      return;
    }

    let movement = e.movementSpeed * delta;

    // Tween along movement
    let remaining =
      ((target.x - e.position.x) ** 2 + (target.y - e.position.y) ** 2) **
        0.5;
    let p = movement / remaining;
    let last = e.position;
    while (p > 1) {
      if (e.queue?.[0].type !== "walk") break;
      e.action = e.queue[0];
      if (e.queue.length > 1) e.queue = e.queue.slice(1);
      else delete e.queue;

      movement -= remaining;
      const nextTarget = typeof e.action.target === "string"
        ? lookup[e.action.target]?.position
        : e.action.target;
      if (!nextTarget) break;
      target = nextTarget;
      remaining =
        ((target.x - e.position.x) ** 2 + (target.y - e.position.y) ** 2) **
          0.5;
      p = movement / remaining;
      last = target;
    }

    e.position = p < 1
      ? {
        x: e.position.x * (1 - p) + target.x * p,
        y: e.position.y * (1 - p) + target.y * p,
      }
      : {
        x: target.x,
        y: target.y,
      };
  },
});
