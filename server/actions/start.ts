import { z } from "zod";

import { interval, timeout } from "../api/timing.ts";
import { newUnit } from "../api/unit.ts";
import { playSoundAt } from "../api/sound.ts";
import { Client } from "../client.ts";
import { lobbyContext } from "../contexts.ts";
import { newEcs } from "../ecs.ts";
import { send } from "../lobbyApi.ts";
import { center, generateDoodads } from "@/shared/map.ts";
import { appContext } from "@/shared/context.ts";
import { getSheepSpawn, getSpiritSpawn } from "../st/getSheepSpawn.ts";
import { addEntity } from "@/shared/api/entity.ts";
import { draftTeams, getIdealSheep, getIdealTime } from "../st/roundHelpers.ts";
import { endRound } from "../lobbyApi.ts";

export const zStart = z.object({
  type: z.literal("start"),
  practice: z.boolean().optional(),
  editor: z.boolean().optional(),
});

export const start = (
  client: Client,
  { practice = false, editor = false }: z.TypeOf<typeof zStart>,
) => {
  const lobby = client.lobby;
  if (
    !lobby || lobby.host !== client ||
    lobby.status === "playing"
  ) return;

  console.log(new Date(), "Round started in lobby", lobby.name);

  lobby.status = "playing";
  const { sheep, wolves } = practice
    ? { sheep: new Set(lobby.players), wolves: new Set<Client>() }
    : draftTeams(lobby, getIdealSheep(lobby.players.size));

  const ecs = newEcs();
  lobby.round = {
    sheep,
    wolves,
    ecs,
    start: Date.now(),
    practice,
    editor,
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

    generateDoodads();

    for (const player of sheep) {
      player.playerEntity = ecs.addEntity({
        name: player.name,
        owner: player.id,
        isPlayer: true,
        team: "sheep",
        gold: practice ? 100_000 : lobby.settings.startingGold.sheep,
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

      if (!practice) {
        addEntity({
          isTimer: true,
          buffs: [{
            expiration: "Time until wolves spawn:",
            remainingDuration: 1.8,
          }],
        });
      }

      timeout(() => {
        const lobby = lobbyContext.current;
        if (!lobby.round) return;
        for (const owner of practice ? sheep : wolves) {
          newUnit(owner.id, "wolf", center.x, center.y);
        }

        if (!practice) {
          if (wolves.size) {
            playSoundAt(center, Math.random() < 0.5 ? "howl1" : "howl2");
          }

          const timeToWin = lobby.settings.time === "auto"
            ? getIdealTime(lobby.players.size, sheep.size)
            : lobby.settings.time;

          addEntity({
            isTimer: true,
            buffs: [{
              expiration: "Time until sheep win:",
              remainingDuration: timeToWin,
            }],
          });

          timeout(() => {
            send({ type: "chat", message: "Sheep win!" });
            endRound();
          }, timeToWin);
        }
      }, practice ? 0 : 1.8);
    }, practice ? 0 : 0.3);
  });
};
