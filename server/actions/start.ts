import { z } from "npm:zod";

import { interval, timeout } from "../api/timing.ts";
import { newUnit } from "../api/unit.ts";
import { Client } from "../client.ts";
import { lobbyContext } from "../contexts.ts";
import { newEcs } from "../ecs.ts";
import { send } from "../lobbyApi.ts";
import { center, initEntities } from "@/shared/map.ts";
import { prefabs } from "@/shared/data.ts";
import { appContext } from "@/shared/context.ts";
import { getSheepSpawn, getSpiritSpawn } from "../st/getSheepSpawn.ts";

export const zStart = z.object({
  type: z.literal("start"),
  practice: z.boolean().optional(),
});

export const start = (
  client: Client,
  { practice = false }: z.TypeOf<typeof zStart>,
) => {
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
  while (pool.size > 0 && (sheep.size < desiredSize || practice)) {
    const scLowest = Math.min(...Array.from(pool, (p) => p.sheepCount));
    const scPool = Array.from(pool).filter((p) => p.sheepCount === scLowest);
    while (scPool.length && (sheep.size < desiredSize || practice)) {
      const i = Math.floor(Math.random() * scPool.length);
      sheep.add(scPool[i]);
      scPool[i].sheepCount++;
      pool.delete(scPool[i]);
      scPool.splice(i, 1);
    }
  }
  for (const p of pool) wolves.add(p);

  const ecs = newEcs();
  lobby.round = {
    sheep,
    wolves,
    ecs,
    start: Date.now(),
    practice,
    clearInterval: interval(() => {
      ecs.tick++;
      ecs.update();
    }, 0.05),
  };

  const withContexts = (fn: () => void) =>
    lobbyContext.with(lobby, () => appContext.with(ecs, fn));

  withContexts(() => {
    send({
      type: "start",
      sheep: Array.from(
        sheep,
        (c) => ({ id: c.id, sheepCount: c.sheepCount }),
      ),
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
        team: "sheep",
        gold: lobby.settings.startingGold.sheep,
      });
    }

    for (const player of wolves) {
      player.playerEntity = ecs.addEntity({
        name: player.name,
        owner: player.id,
        isPlayer: true,
        team: "wolf",
        gold: lobby.settings.startingGold.wolves,
      });
    }

    timeout(() => {
      const lobby2 = lobbyContext.current;
      if (!lobby2.round) return;
      for (const owner of sheep) {
        newUnit(owner.id, "sheep", ...getSheepSpawn());
        if (practice) newUnit(owner.id, "spirit", ...getSpiritSpawn());
      }

      timeout(() => {
        const lobby = lobbyContext.current;
        if (!lobby.round) return;
        for (const owner of wolves.size ? wolves : sheep) {
          newUnit(owner.id, "wolf", center.x, center.y);
        }
      }, 1.8);
    }, 0.3);
  });
};
