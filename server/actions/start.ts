import { z } from "zod";

import { interval, timeout } from "../api/timing.ts";
import { newUnit } from "../api/unit.ts";
import { playSoundAt } from "../api/sound.ts";
import { Client } from "../client.ts";
import { lobbyContext } from "../contexts.ts";
import { newEcs } from "../ecs.ts";
import { send } from "../lobbyApi.ts";
import { center, generateDoodads } from "@/shared/map.ts";
import { TICK_RATE } from "@/shared/constants.ts";
import { appContext } from "@/shared/context.ts";
import { getSheepSpawn } from "../st/getSheepSpawn.ts";
import { addEntity } from "@/shared/api/entity.ts";
import { draftTeams, getIdealSheep, getIdealTime } from "../st/roundHelpers.ts";
import { endRound } from "../lobbyApi.ts";
import { spawnPracticeUnits } from "../api/player.ts";
import { Entity } from "@/shared/types.ts";

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

  if (lobby.players.size === 1) practice = true;

  console.log(new Date(), "Round started in lobby", lobby.name);

  lobby.status = "playing";
  const desiredSheep = lobby.settings.sheep === "auto"
    ? getIdealSheep(lobby.players.size)
    : Math.min(
      Math.max(lobby.settings.sheep, 1),
      Math.max(lobby.players.size - 1, 1),
    );
  const { sheep, wolves } = practice
    ? { sheep: new Set(lobby.players), wolves: new Set<Client>() }
    : draftTeams(lobby, desiredSheep);

  const ecs = newEcs();
  lobby.round = {
    sheep,
    wolves,
    ecs,
    start: Date.now(),
    practice,
    editor,
    clearInterval: () => {},
  };
  lobby.round.clearInterval = interval(() => {
    ecs.tick++;
    ecs.update();
  }, TICK_RATE);

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

    // Don't need to pollute server with cosmetic entities
    generateDoodads(editor ? [] : ["static", "dynamic"]);

    for (const player of sheep) {
      player.playerEntity = ecs.addEntity({
        name: player.name,
        owner: player.id,
        playerColor: player.color,
        isPlayer: true,
        team: "sheep",
        gold: practice ? 100_000 : lobby.settings.startingGold.sheep,
      });
    }

    for (const player of wolves) {
      player.playerEntity = ecs.addEntity({
        name: player.name,
        owner: player.id,
        playerColor: player.color,
        isPlayer: true,
        team: "wolf",
        gold: lobby.settings.startingGold.wolves,
      });
    }

    timeout(() => {
      const lobby2 = lobbyContext.current;
      if (!lobby2.round) return;
      const sheepPool: Entity[] = [];
      for (const owner of sheep) {
        if (practice) {
          sheepPool.push(spawnPracticeUnits(owner.id));
        } else {
          sheepPool.push(newUnit(owner.id, "sheep", ...getSheepSpawn()));
        }
      }

      if (!practice) {
        if (lobby.settings.mode === "vip") {
          const vip = sheepPool[Math.floor(Math.random() * sheepPool.length)];
          vip.buffs = [...(vip.buffs ?? []), {
            model: "vip",
            modelOffset: { y: 0.5 },
          }];
          if (lobby.round) lobby.round.vip = vip.owner;

          // Apply handicap to all non-VIP sheep players
          for (const player of sheep) {
            if (player.id !== vip.owner && player.playerEntity) {
              player.playerEntity.handicap = lobby.settings.vipHandicap;
            }
          }
        }

        addEntity({
          isTimer: true,
          buffs: [{
            expiration: "Time until wolves spawn:",
            remainingDuration: 1.8,
            totalDuration: 1.8,
          }],
        });
      }

      timeout(() => {
        const lobby = lobbyContext.current;
        if (!lobby.round) return;

        if (!practice) {
          lobby.round.start = Date.now();

          for (const owner of wolves) {
            newUnit(owner.id, "wolf", center.x, center.y);
          }

          playSoundAt(center, Math.random() < 0.5 ? "howl1" : "howl2");

          if (lobby.settings.mode !== "switch") {
            const timeToWin = lobby.settings.time === "auto"
              ? getIdealTime(lobby.players.size, sheep.size)
              : lobby.settings.time;

            addEntity({
              isTimer: true,
              buffs: [{
                expiration: "Time until sheep win:",
                remainingDuration: timeToWin,
                totalDuration: timeToWin,
              }],
            });

            timeout(() => {
              send({ type: "chat", message: "Sheep win!" });
              endRound();
            }, timeToWin);
          }
        }
      }, practice ? 0 : 1.8);
    }, practice ? 0 : 0.3);
  });
};
