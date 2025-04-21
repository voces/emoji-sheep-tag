import { SystemEntity } from "jsr:@verit/ecs";
import { z } from "npm:zod";

import { Entity } from "../../shared/types.ts";
import { Client } from "../client.ts";
import { lobbyContext } from "../contexts.ts";
import { orderAttack as orderAttack } from "../api/unit.ts";

export const zAttack = z.object({
  type: z.literal("attack"),
  units: z.string().array(),
  target: z.string(), // TODO: support attack-move?
});

export const attack = (
  client: Client,
  { units, target }: z.TypeOf<typeof zAttack>,
) => {
  const round = lobbyContext.context.round;
  if (!round) return;
  const attackingUnits = units
    .map((u) => round.lookup[u])
    .filter((
      e: Entity | undefined,
    ): e is SystemEntity<Entity, "position" | "attack"> =>
      !!e && e.owner === client.id && !!e.attack && !!e.position
    );
  if (!attackingUnits.length) return;
  attackingUnits.forEach((u) => {
    // Interrupt
    delete u.action;
    delete u.queue;

    const targetEntity = round.lookup[target];
    if (!targetEntity) return;

    orderAttack(u, targetEntity);
  });
};
