import { SystemEntity } from "jsr:@verit/ecs";
import { z } from "npm:zod";

import { Entity } from "../../shared/types.ts";
import { Client } from "../client.ts";
import { lobbyContext } from "../contexts.ts";
import { calcPath } from "../systems/pathing.ts";
import { zPoint } from "../../shared/zod.ts";

export const zMove = z.object({
  type: z.literal("move"),
  units: z.string().array(),
  target: z.union([zPoint, z.string()]),
});

export const move = (
  client: Client,
  { units, target }: z.TypeOf<typeof zMove>,
) => {
  const round = lobbyContext.context.round;
  if (!round) return;
  const movedUnits = units
    .map((u) => round.lookup[u])
    .filter((e: Entity | undefined): e is SystemEntity<Entity, "position"> =>
      !!e && e.owner === client.id && !!e.position
    );
  if (!movedUnits.length) return console.log("no units!");
  movedUnits.forEach((u) => {
    // Interrupt
    delete u.action;
    delete u.queue;

    const targetPos = typeof target === "string"
      ? round.lookup[target]?.position
      : target;
    if (!targetPos) return;

    // If no radius, tween to target
    if (!u.radius) {
      return u.action = {
        type: "walk",
        target,
        path: [{ x: u.position.x, y: u.position.y }, targetPos],
        distanceFromTarget: typeof target === "string"
          ? u.attack?.range
          : undefined,
      };
    }

    // Otherwise path find to target
    const path = calcPath(u, target).slice(1);
    if (!path.length) return;
    u.action = {
      type: "walk",
      target: typeof target === "string" ? target : path[path.length - 1],
      path,
      distanceFromTarget: typeof target === "string"
        ? u.attack?.range
        : undefined,
    };
  });
};
