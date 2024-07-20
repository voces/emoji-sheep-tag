import { z } from "npm:zod";

import { interval, timeout } from "../api/timing.ts";
import { newUnit } from "../api/unit.ts";
import { Client } from "../client.ts";
import { lobbyContext } from "../contexts.ts";
import { newEcs } from "../ecs.ts";
import { send } from "../lobbyApi.ts";
import { flushUpdates } from "../updates.ts";

export const zStart = z.object({ type: z.literal("start") });

export const start = (client: Client) => {
  const lobby = client.lobby;
  if (
    !lobby || lobby.host !== client ||
    lobby.status === "playing"
  ) return;
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
    clearInterval: interval(() => {
      ecs.update();
      flushUpdates();
    }, 50),
  };

  lobbyContext.with(lobby, () => {
    send({
      type: "start",
      sheep: Array.from(sheep, (c) => c.id),
      wolves: Array.from(wolves, (c) => c.id),
    });

    timeout(() => {
      const lobby = lobbyContext.context;
      if (!lobby.round) return;
      for (const owner of sheep) newUnit(owner.id, "sheep", 25, 25);

      timeout(() => {
        const lobby = lobbyContext.context;
        console.log("timeout!", lobby.round, wolves);
        if (!lobby.round) return;
        for (const owner of wolves) newUnit(owner.id, "wolf", 25, 25);
      }, 2000);
    }, 300);
  });
};
