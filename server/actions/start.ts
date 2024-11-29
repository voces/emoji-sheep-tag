import { z } from "npm:zod";

import { interval, timeout } from "../api/timing.ts";
import { newUnit } from "../api/unit.ts";
import { Client } from "../client.ts";
import { lobbyContext } from "../contexts.ts";
import { newEcs } from "../ecs.ts";
import { send } from "../lobbyApi.ts";
import { flushUpdates } from "../updates.ts";
import { Entity } from "../../shared/types.ts";
import { init } from "../st/data.ts";

export const zStart = z.object({ type: z.literal("start") });

export const start = (client: Client) => {
  const lobby = client.lobby;
  if (
    !lobby || lobby.host !== client ||
    lobby.status === "playing"
  ) return;
  console.log("Starting round");
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
      // console.debug("update start");
      ecs.update();
      flushUpdates();
      // console.debug("update end");
    }, 0.05),
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

    timeout(() => {
      const lobby = lobbyContext.context;
      if (!lobby.round) return;
      const r = Math.random() * Math.PI * 2;
      let lastSheep: Entity;
      for (const owner of sheep) {
        lastSheep = newUnit(
          owner.id,
          "sheep",
          25 + 3 * Math.cos(r),
          25 + 3 * Math.sin(r),
        );
      }
      // for (let y = 19; y < 32; y += 1.5) {
      //   for (let x = 16; x < 35; x += 1.5) {
      //     newUnit(Array.from(sheep)[0].id, "hut", x, y);
      //   }
      // }

      timeout(() => {
        const lobby = lobbyContext.context;
        if (!lobby.round) return;
        for (const owner of wolves) {
          const wolf = newUnit(owner.id, "wolf", 25, 25);
          if (!wolf.queue) {
            wolf.queue = [{ type: "attack", target: lastSheep.id }];
          } else {
            wolf.queue = [...wolf.queue, {
              type: "attack",
              target: lastSheep.id,
            }];
          }
        }
      }, 0.5);
    }, 0.3);
  });
};
