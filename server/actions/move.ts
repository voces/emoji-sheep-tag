import { SystemEntity } from "jsr:@verit/ecs";
import { z } from "npm:zod";

import { Entity } from "../../shared/types.ts";
import { Client } from "../client.ts";
import { lobbyContext } from "../contexts.ts";
import { calcPath } from "../systems/pathing.ts";

export const zMove = z.object({
  type: z.literal("move"),
  units: z.string().array(),
  x: z.number(),
  y: z.number(),
});

export const move = (
  client: Client,
  { units, x, y }: z.TypeOf<typeof zMove>,
) => {
  const round = lobbyContext.context.round;
  if (!round) return;
  const movedUnits = units
    .map((u) => round.lookup[u])
    .filter((e: Entity | undefined): e is Entity =>
      !!e && e.owner === client.id
    );
  if (!movedUnits.length) return console.log("no units!");
  movedUnits.forEach((u) => {
    // Interrupt
    delete u.action;
    delete u.queue;

    // If no position, just instantly move to target
    if (!u.position) return u.position = { x, y };

    // If no radius, tween to target
    if (!u.radius) {
      return u.action = {
        type: "walk",
        target: { x, y },
        path: [{ x: u.position.x, y: u.position.y }, { x, y }],
      };
    }

    // Otherwise path find to target
    if (u.radius) {
      const path = calcPath(
        u as SystemEntity<Entity, "radius" | "position">,
        { x, y },
      ).slice(1);
      console.log("walk", path);
      u.action = { type: "walk", target: path[path.length - 1], path };
    }
  });
};
