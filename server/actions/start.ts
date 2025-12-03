import { z } from "zod";

import { interval, timeout } from "../api/timing.ts";
import { newUnit } from "../api/unit.ts";
import { playSoundAt } from "../api/sound.ts";
import { Client } from "../client.ts";
import { lobbyContext } from "../contexts.ts";
import { newEcs } from "../ecs.ts";
import { send } from "../lobbyApi.ts";
import { generateDoodads, getMapCenter } from "@/shared/map.ts";
import { TICK_RATE } from "@/shared/constants.ts";
import { appContext } from "@/shared/context.ts";
import { getSheepSpawn } from "../st/getSheepSpawn.ts";
import { addEntity } from "@/shared/api/entity.ts";
import {
  draftTeams,
  getIdealSheep,
  getIdealTime,
  recordTeams,
  undoDraft,
} from "../st/roundHelpers.ts";
import { endRound } from "../lobbyApi.ts";
import { spawnPracticeUnits } from "../api/player.ts";
import { Entity } from "@/shared/types.ts";
import { clearUpdatesCache, flushUpdates } from "../updates.ts";
import { Lobby } from "../lobby.ts";
import { createServerMap } from "../maps.ts";
import { colorName } from "@/shared/api/player.ts";

export const zStart = z.object({
  type: z.literal("start"),
  practice: z.boolean().optional(),
  editor: z.boolean().optional(),
  fixedTeams: z.boolean().optional(),
});

type TeamAssignment = {
  sheep: Set<Client>;
  wolves: Set<Client>;
};

const assignPracticeTeams = (lobby: Lobby): TeamAssignment => {
  const allPlayers = Array.from(lobby.players);
  const nonObservers = allPlayers.filter((p) =>
    p.team !== "observer" && p.team !== "pending"
  );
  return {
    sheep: new Set(nonObservers),
    wolves: new Set<Client>(),
  };
};

const assignFixedTeams = (lobby: Lobby): TeamAssignment => {
  const allPlayers = Array.from(lobby.players);
  const nonObservers = allPlayers.filter((p) =>
    p.team !== "observer" && p.team !== "pending"
  );
  const currentSheep = nonObservers.filter((p) => p.team === "sheep");
  const currentWolves = nonObservers.filter((p) => p.team === "wolf");

  // Validate teams - must have at least 1 sheep and 1 wolf
  if (currentSheep.length === 0 && currentWolves.length > 0) {
    // No sheep - use smart to pick one wolf to become sheep
    const drafted = draftTeams(currentWolves, 1);
    const sheep = drafted.sheep;
    const wolves = new Set(currentWolves.filter((w) => !sheep.has(w)));

    // Apply team assignment
    for (const player of sheep) player.team = "sheep";
    return { sheep, wolves };
  }

  if (currentWolves.length === 0 && currentSheep.length > 0) {
    // No wolves - use smart to pick one sheep to become wolf
    const drafted = draftTeams(currentSheep, currentSheep.length - 1);
    const sheep = drafted.sheep;
    const wolves = new Set(currentSheep.filter((s) => !sheep.has(s)));

    // Apply team assignment
    for (const player of wolves) player.team = "wolf";
    return { sheep, wolves };
  }

  return {
    sheep: new Set(currentSheep),
    wolves: new Set(currentWolves),
  };
};

const assignRandomTeams = (lobby: Lobby): TeamAssignment => {
  const allPlayers = Array.from(lobby.players);
  const nonObservers = allPlayers.filter((p) =>
    p.team !== "observer" && p.team !== "pending"
  );

  // Determine desired sheep count (excluding observers)
  const desiredSheep = lobby.settings.sheep === "auto"
    ? getIdealSheep(nonObservers.length)
    : Math.min(
      Math.max(lobby.settings.sheep, 1),
      Math.max(nonObservers.length - 1, 1),
    );

  // Draft teams using smart algorithm
  const drafted = draftTeams(nonObservers, desiredSheep);

  // Apply team assignments to actual players
  for (const player of nonObservers) {
    if (drafted.sheep.has(player)) {
      player.team = "sheep";
    } else if (drafted.wolves.has(player)) {
      player.team = "wolf";
    }
  }

  return { sheep: drafted.sheep, wolves: drafted.wolves };
};

const determineTeams = (
  lobby: Lobby,
  practice: boolean,
  fixedTeams: boolean,
): TeamAssignment => {
  if (practice) return assignPracticeTeams(lobby);
  if (fixedTeams) return assignFixedTeams(lobby);
  return assignRandomTeams(lobby);
};

const createPlayerEntities = (
  ecs: ReturnType<typeof newEcs>,
  lobby: Lobby,
  sheep: Set<Client>,
  wolves: Set<Client>,
  practice: boolean,
) => {
  const isTeamGold = !practice &&
    (lobby.settings.mode === "vip" ||
      (lobby.settings.mode === "survival" && lobby.settings.teamGold));

  // Create team entities for team gold mode
  if (isTeamGold) {
    ecs.addEntity({
      id: "team-sheep",
      isTeam: true,
      team: "sheep",
      gold: 0,
    });
    ecs.addEntity({
      id: "team-wolf",
      isTeam: true,
      team: "wolf",
      gold: lobby.settings.startingGold.wolves,
    });
  }

  for (const c of sheep) {
    const player = ecs.addEntity(c);
    player.team = "sheep";
    // In team gold mode, starting gold goes to team pool (already set above as 0)
    // Individual sheep get 0 starting gold in team mode
    player.gold = practice
      ? 100_000
      : isTeamGold
      ? 0
      : lobby.settings.startingGold.sheep;
    if (lobby.settings.mode !== "switch") {
      player.sheepCount = (player.sheepCount ?? 0) + 1;
    }
  }

  for (const c of wolves) {
    const player = ecs.addEntity(c);
    player.team = "wolf";
    // In team gold mode, wolves have no individual gold (all team pooled)
    player.gold = isTeamGold ? 0 : lobby.settings.startingGold.wolves;
  }

  // In practice mode, create an additional enemy player entity
  if (practice) {
    ecs.addEntity({
      id: "practice-enemy",
      name: "Enemy",
      isPlayer: true,
      team: "wolf",
      gold: 100_000,
      playerColor: "#ff0000",
    });
  }
};

const spawnSheepUnits = (
  sheep: Set<Client>,
  practice: boolean,
): Entity[] => {
  const sheepPool: Entity[] = [];
  for (const owner of sheep) {
    if (practice) {
      sheepPool.push(spawnPracticeUnits(owner.id));
    } else {
      sheepPool.push(newUnit(owner.id, "sheep", ...getSheepSpawn()));
    }
  }
  return sheepPool;
};

const setupVipMode = (
  lobby: Lobby,
  sheep: Set<Client>,
  sheepPool: Entity[],
) => {
  // In captains mode, the sheep captain is always VIP
  const draft = lobby.captainsDraft;
  const sheepCaptainId = draft?.captains.find((captainId) =>
    sheep.values().some((p) => p.id === captainId)
  );
  const vip = sheepCaptainId
    ? sheepPool.find((s) => s.owner === sheepCaptainId) ??
      sheepPool[Math.floor(Math.random() * sheepPool.length)]
    : sheepPool[Math.floor(Math.random() * sheepPool.length)];
  vip.buffs = [...(vip.buffs ?? []), {
    model: "vip",
    modelOffset: { y: 0.5 },
  }];
  if (lobby.round) lobby.round.vip = vip.owner;

  // Apply handicap to all non-VIP sheep players
  for (const player of sheep) {
    if (player.id !== vip.owner) {
      player.handicap = lobby.settings.vipHandicap;
    }
  }
};

const spawnWolves = (wolves: Set<Client>) => {
  const center = getMapCenter();
  for (const owner of wolves) {
    newUnit(owner.id, "wolf", center.x, center.y);
  }
  playSoundAt(center, Math.random() < 0.5 ? "howl1" : "howl2");
};

const setupSurvivalTimer = (lobby: Lobby, sheep: Set<Client>) => {
  if (!lobby.round) return;

  lobby.round.duration = lobby.settings.time === "auto"
    ? getIdealTime(lobby.players.size, sheep.size)
    : lobby.settings.time;

  addEntity({
    isTimer: true,
    buffs: [{
      expiration: "Time until sheep win:",
      remainingDuration: lobby.round.duration,
      totalDuration: lobby.round.duration,
    }],
  });

  timeout(() => {
    send({ type: "chat", message: "Sheep win!" });
    endRound();
  }, lobby.round.duration);
};

export const start = (
  client: Client,
  { practice = false, editor = false, fixedTeams = true }: z.TypeOf<
    typeof zStart
  >,
) => {
  const lobby = client.lobby;
  if (
    !lobby || lobby.host !== client ||
    lobby.status === "playing"
  ) return;

  // Count non-observer players
  const activePlayers = Array.from(lobby.players).filter((p) =>
    p.team !== "observer" && p.team !== "pending"
  );

  // Require at least 1 active player for any game mode
  if (activePlayers.length < 1) return;

  // Require at least 2 active players for non-practice games
  if (!practice && activePlayers.length < 2) return;

  // Single active player automatically switches to practice mode
  if (activePlayers.length === 1) practice = true;

  lobby.status = "playing";

  // Clear captains draft when using Smart (randomized teams)
  if (!fixedTeams && lobby.captainsDraft) {
    lobby.captainsDraft = undefined;
    send({ type: "captainsDraft", phase: undefined });
  }

  const { sheep, wolves } = determineTeams(lobby, practice, fixedTeams);

  console.log(
    new Date(),
    `${practice ? "Practice round" : "Round"} started in lobby ${lobby.name}${
      practice
        ? ""
        : `. ${Array.from(sheep, (s) => s.name).join(", ")} vs ${
          Array.from(wolves, (w) => w.name).join(", ")
        }`
    }`,
  );

  // Update smart drafter counts (unless in switch mode)
  if (!practice && lobby.settings.mode !== "switch") {
    if (fixedTeams) {
      // For fixed teams, record the sheep team composition
      recordTeams(Array.from(sheep).map((s) => s.id));
    }
    // For randomized teams, counts are already updated by draftTeams
  } else if (!practice && lobby.settings.mode === "switch" && !fixedTeams) {
    // In switch mode with randomized teams, undo the draft to not track counts
    undoDraft();
  }

  clearUpdatesCache();
  const map = createServerMap(lobby.settings.map, lobby);
  const ecs = newEcs(map);
  lobby.round = {
    ecs,
    practice,
    editor,
    clearInterval: () => {},
  };
  lobby.round.clearInterval = interval(() => {
    ecs.tick++;
    ecs.update();
  }, TICK_RATE);

  const withContexts = (fn: () => void) =>
    appContext.with(ecs, () => ecs.batch(fn));

  withContexts(() => {
    generateDoodads(editor ? undefined : ["static", "dynamic"]);

    // Add map center marker in editor mode
    if (editor) {
      const center = getMapCenter();
      addEntity({
        id: "map-center-marker",
        position: { x: center.x, y: center.y },
        model: "atom",
      });
    }

    createPlayerEntities(ecs, lobby, sheep, wolves, practice);
    send({ type: "start", updates: flushUpdates(false) });

    if (!practice) {
      send({ type: "chat", message: "\u202f" });
      send({
        type: "chat",
        message: `${
          new Intl.ListFormat().format(
            Array.from(sheep).map((s) => colorName(s)),
          )
        } vs ${
          new Intl.ListFormat().format(
            Array.from(wolves).map((w) => colorName(w)),
          )
        }`,
      });

      addEntity({
        isTimer: true,
        buffs: [{
          expiration: "Time until sheep spawn:",
          remainingDuration: 3,
          totalDuration: 3,
        }],
      });
      send({ type: "chat", message: "Starting in 3…" });
      timeout(() => send({ type: "chat", message: "Starting in 2…" }), 1);
      timeout(() => send({ type: "chat", message: "Starting in 1…" }), 2);
    }

    timeout(() => {
      const lobby2 = lobbyContext.current;
      if (!lobby2.round) return;

      const sheepPool = spawnSheepUnits(sheep, practice);

      if (!practice) {
        if (lobby.settings.mode === "vip") {
          setupVipMode(lobby, sheep, sheepPool);
        }
        addEntity({
          isTimer: true,
          buffs: [{
            expiration: "Time until wolves spawn:",
            remainingDuration: 18,
            totalDuration: 18,
          }],
        });
      }
    }, practice ? 0 : 3);

    timeout(() => {
      const lobby = lobbyContext.current;
      if (!lobby.round) return;

      if (!practice) {
        lobby.round.start = Date.now();
        spawnWolves(wolves);

        if (lobby.settings.mode !== "switch") {
          setupSurvivalTimer(lobby, sheep);
        }
      }
    }, practice ? 0 : 21);
  });
};
