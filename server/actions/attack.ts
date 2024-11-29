import { SystemEntity } from "jsr:@verit/ecs";
import { z } from "npm:zod";

import { Entity } from "../../shared/types.ts";
import { Client } from "../client.ts";
import { lobbyContext } from "../contexts.ts";
import { calcPath } from "../systems/pathing.ts";
import { zPoint } from "../../shared/zod.ts";

export const zAttack = z.object({
  type: z.literal("attack"),
  units: z.string().array(),
  target: z.union([zPoint, z.string()]),
});

export const attack = (
  client: Client,
  { units, target }: z.TypeOf<typeof zAttack>,
) => {
  console.log("attack");
  const round = lobbyContext.context.round;
  if (!round) return;
  const attackingUnits = units
    .map((u) => round.lookup[u])
    .filter((
      e: Entity | undefined,
    ): e is SystemEntity<Entity, "position" | "attack"> =>
      !!e && e.owner === client.id && !!e.attack && !!e.position
    );
  if (!attackingUnits.length) return console.log("no units!");
  attackingUnits.forEach((u) => {
    // Interrupt
    delete u.action;
    delete u.queue;

    const targetPos = typeof target === "string"
      ? round.lookup[target]?.position
      : target;
    if (!targetPos) return;

    // Path to target and attack
    const path = calcPath(u, target, "attack").slice(1);
    if (!path.length) return;
    u.action = {
      type: "walk",
      target: typeof target === "string" ? target : path[path.length - 1],
      distanceFromTarget: u.attack.range,
      path,
      attacking: true,
    };
    if (typeof target === "string") u.queue = [{ type: "attack", target }];
  });
};
