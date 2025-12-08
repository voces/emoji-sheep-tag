import { z } from "zod";

import { Client } from "../client.ts";
import { endRound, send } from "../lobbyApi.ts";
import {
  draftTeams,
  getIdealSheep,
  recordTeams,
  undoDraft,
} from "../st/roundHelpers.ts";
import { initializeGame } from "../st/gameStartHelpers.ts";
import { Lobby } from "../lobby.ts";
import { createServerMap } from "../maps.ts";
import { getShard, sendToShard } from "../shardRegistry.ts";
import { getCustomMapForLobby } from "./uploadCustomMap.ts";
import { id as generateId } from "@/shared/util/id.ts";

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

type Shard = NonNullable<ReturnType<typeof getShard>>;

const startOnShard = (
  lobby: Lobby,
  shard: Shard,
  sheep: Set<Client>,
  wolves: Set<Client>,
  practice: boolean,
  editor: boolean,
) => {
  // Generate auth tokens for each player
  const playerTokens = new Map<Client, string>();
  for (const player of lobby.players) {
    playerTokens.set(player, generateId("token"));
  }

  // Get custom map data if applicable
  const mapId = lobby.settings.map;
  const customMapData = mapId.startsWith("local:")
    ? getCustomMapForLobby(lobby, mapId)
    : undefined;

  // Send lobby assignment to shard
  sendToShard(shard, {
    type: "assignLobby",
    lobbyId: lobby.name,
    settings: {
      map: lobby.settings.map,
      mode: lobby.settings.mode,
      vipHandicap: lobby.settings.vipHandicap,
      sheep: lobby.settings.sheep,
      time: lobby.settings.time,
      startingGold: lobby.settings.startingGold,
      income: lobby.settings.income,
      view: lobby.settings.view,
      teamGold: lobby.settings.teamGold,
    },
    players: Array.from(lobby.players).map((p) => ({
      id: p.id,
      name: p.name,
      playerColor: p.playerColor,
      team: sheep.has(p) ? "sheep" : wolves.has(p) ? "wolf" : p.team,
      sheepCount: p.sheepCount,
      token: playerTokens.get(p)!,
    })),
    hostId: lobby.host?.id ?? null,
    practice,
    editor,
    customMapData,
  });

  // Send connectToShard to each client
  for (const player of lobby.players) {
    const token = playerTokens.get(player)!;
    player.send({
      type: "connectToShard",
      shardUrl: shard.publicUrl,
      token,
      lobbyId: lobby.name,
    });
  }

  console.log(
    new Date(),
    `[Shard] ${
      practice ? "Practice round" : "Round"
    } in ${lobby.name} -> ${shard.name}${
      practice
        ? ""
        : `. ${Array.from(sheep, (s) => s.name).join(", ")} vs ${
          Array.from(wolves, (w) => w.name).join(", ")
        }`
    }`,
  );
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

  // If a shard is selected, redirect to it instead of running locally
  const shard = lobby.settings.shard
    ? getShard(lobby.settings.shard)
    : undefined;
  if (shard) {
    startOnShard(lobby, shard, sheep, wolves, practice, editor);
    return;
  }

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

  const map = createServerMap(lobby.settings.map, lobby);

  // Get sheep captain for VIP mode
  const draft = lobby.captainsDraft;
  const sheepCaptainId = draft?.captains.find((captainId) =>
    Array.from(sheep).some((p) => p.id === captainId)
  );

  const sheepArr = Array.from(sheep);
  const wolvesArr = Array.from(wolves);

  lobby.round = initializeGame({
    map,
    settings: lobby.settings,
    sheep: sheepArr,
    wolves: wolvesArr,
    practice,
    editor,
    onSheepWin: () => {
      send({ type: "chat", message: "Sheep win!" });
      endRound();
    },
    sheepCaptainId,
  });
};
