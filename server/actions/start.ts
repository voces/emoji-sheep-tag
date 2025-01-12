import { z } from "npm:zod";

import { interval, timeout } from "../api/timing.ts";
import { newUnit } from "../api/unit.ts";
import { Client } from "../client.ts";
import { lobbyContext } from "../contexts.ts";
import { newEcs } from "../ecs.ts";
import { send } from "../lobbyApi.ts";
import { init } from "../st/data.ts";
import { center, initEntities } from "../../shared/map.ts";
import { unitData } from "../../shared/data.ts";

export const zStart = z.object({ type: z.literal("start") });

export const start = (client: Client) => {
  const lobby = client.lobby;
  if (
    !lobby || lobby.host !== client ||
    lobby.status === "playing"
  ) return;

  console.log(new Date(), "Round started in lobby", lobby.name);

  lobby.status = "playing";
  const sheep = new Set<Client>();
  const wolves = new Set<Client>();
  const pool = Array.from(lobby.players);
  for (const player of pool) {
    if (!sheep.size) sheep.add(player);
    else if (sheep.size + 1 < wolves.size) sheep.add(player);
    else wolves.add(player);
  }

  const { ecs, lookup } = newEcs();
  lobby.round = {
    sheep,
    wolves,
    ecs,
    lookup,
    start: Date.now(),
    clearInterval: interval(() => ecs.update(), 0.05),
  };

  lobbyContext.with(lobby, () => {
    init({
      sheep: Array.from(sheep).map((client) => ({ client })),
      wolves: Array.from(wolves).map((client) => ({ client })),
    });

    send({
      type: "start",
      sheep: Array.from(sheep, (c) => c.id),
      wolves: Array.from(wolves, (c) => c.id),
    });

    for (const unitType in initEntities) {
      for (
        const [x, y] of initEntities[unitType as keyof typeof initEntities]
      ) {
        ecs.add({
          unitType,
          position: { x, y },
          ...unitData[unitType],
        });
      }
    }

    timeout(() => {
      const lobby2 = lobbyContext.context;
      if (!lobby2.round) return;
      const r = Math.random() * Math.PI * 2;
      for (const owner of sheep) {
        newUnit(
          owner.id,
          "sheep",
          center.x + 3 * Math.cos(r),
          center.y + 3 * Math.sin(r),
        );
      }

      timeout(() => {
        const lobby = lobbyContext.context;
        if (!lobby.round) return;
        for (const owner of wolves) {
          newUnit(owner.id, "wolf", center.x, center.y);
        }
      }, 1.8);
    }, 0.3);
  });
};
