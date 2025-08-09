import { z } from "npm:zod";

import { interval, timeout } from "../api/timing.ts";
import { newUnit } from "../api/unit.ts";
import { Client } from "../client.ts";
import { lobbyContext } from "../contexts.ts";
import { newEcs } from "../ecs.ts";
import { send } from "../lobbyApi.ts";
import { init } from "../st/data.ts";
import { center, initEntities } from "@/shared/map.ts";
import { prefabs } from "@/shared/data.ts";

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
  const pool = new Set(lobby.players);
  const desiredSize = Math.max(Math.floor((pool.size - 1) / 2), 1);
  while (sheep.size < desiredSize) {
    const scLowest = Math.min(...Array.from(pool, (p) => p.sheepCount));
    const scPool = Array.from(pool).filter((p) => p.sheepCount === scLowest);
    while (scPool.length && sheep.size < desiredSize) {
      const i = Math.floor(Math.random() * scPool.length);
      sheep.add(scPool[i]);
      scPool[i].sheepCount++;
      pool.delete(scPool[i]);
      scPool.splice(1, 1);
    }
  }
  for (const p of pool) wolves.add(p);

  const ecs = newEcs();
  lobby.round = {
    sheep,
    wolves,
    ecs,
    start: Date.now(),
    clearInterval: interval(() => {
      ecs.tick++;
      ecs.update();
    }, 0.05),
  };

  lobbyContext.with(lobby, () => {
    init({
      sheep: Array.from(sheep).map((client) => ({ client })),
      wolves: Array.from(wolves).map((client) => ({ client })),
    });

    send({
      type: "start",
      sheep: Array.from(sheep, (c) => ({ id: c.id, sheepCount: c.sheepCount })),
      wolves: Array.from(wolves, (c) => c.id),
    });

    for (const prefab in initEntities) {
      for (
        const partial of initEntities[prefab as keyof typeof initEntities]
      ) ecs.addEntity({ prefab, ...prefabs[prefab], ...partial });
    }

    for (const player of sheep) {
      player.playerEntity = ecs.addEntity({
        name: player.name,
        owner: player.id,
        isPlayer: true,
        gold: lobby.settings.startingGold.sheep,
      });
    }

    for (const player of wolves) {
      player.playerEntity = ecs.addEntity({
        name: player.name,
        owner: player.id,
        isPlayer: true,
        gold: lobby.settings.startingGold.wolves,
      });
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
