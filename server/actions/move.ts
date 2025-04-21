import { SystemEntity } from "jsr:@verit/ecs";
import { z } from "npm:zod";

import { Entity } from "../../shared/types.ts";
import { Client } from "../client.ts";
import { lobbyContext } from "../contexts.ts";
import { zPoint } from "../../shared/zod.ts";
import { orderMove } from "../api/unit.ts";

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
  if (!movedUnits.length) return;
  movedUnits.forEach((u) => {
    // Interrupt
    delete u.action;
    delete u.queue;

    const resolvedTarget = typeof target === "string"
      ? round.lookup[target]
      : target;
    if (!resolvedTarget) return;

    orderMove(u, resolvedTarget);
  });
};
