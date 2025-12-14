import { ServerToClientMessage } from "../client/client.ts";
import { Client } from "./client.ts";
import { clientContext, lobbyContext } from "./contexts.ts";
import { deleteLobby } from "./lobby.ts";
import { clearUpdatesCache, flushUpdates } from "./updates.ts";
import { serializeLobbySettings } from "./actions/lobbySettings.ts";
import { findPlayerUnit, getPlayerUnits } from "./systems/playerEntities.ts";
import { getPlayer } from "@/shared/api/player.ts";
import { sendPlayerGold } from "./api/player.ts";
import { getSheep } from "./systems/sheep.ts";
import { distributeEquitably } from "./util/equitableDistribution.ts";
import { isPractice } from "./api/st.ts";
import { broadcastLobbyList, joinHub } from "./hub.ts";
import type { Entity } from "@/shared/types.ts";
import { autoAssignSheepOrWolf } from "./st/roundHelpers.ts";
import { getCustomMapForLobby } from "./actions/uploadCustomMap.ts";
import type { Lobby } from "./lobby.ts";
import {
  handleCaptainsPlayerLeave,
  isActiveCaptainsDraft,
  serializeCaptainsDraft,
} from "./actions/captains.ts";
import { broadcastShards } from "./shardRegistry.ts";

const convertPendingPlayersToTeams = (lobby: Lobby) => {
  const pendingPlayers = Array.from(lobby.players).filter((p) =>
    p.team === "pending"
  );
  if (pendingPlayers.length === 0) return;

  for (const player of pendingPlayers) {
    player.team = autoAssignSheepOrWolf(lobby);
  }
};

export const createRoundSummary = () => {
  const lobby = lobbyContext.current;
  return {
    sheep: Array.from(lobby.players).filter((p) => p.team === "sheep").map((
      p,
    ) => p.id),
    wolves: Array.from(lobby.players).filter((p) => p.team === "wolf").map((
      p,
    ) => p.id),
    duration: Math.min(
      (lobby.round?.duration ?? 0) * 1000,
      Date.now() - (lobby.round?.start ?? Date.now()),
    ),
  };
};

export const endRound = (canceled = false) => {
  const lobby = lobbyContext.current;
  if (!lobby.round) return;
  const wasPractice = lobby.round.practice;
  console.log(new Date(), "Round ended in lobby", lobby.name);
  lobby.round.clearInterval();

  if (lobby.settings.mode === "vip") {
    for (const p of lobby.players) p.handicap = undefined;
  }

  convertPendingPlayersToTeams(lobby);

  const round = !canceled &&
      !lobby.round.practice &&
      lobby.settings.mode !== "switch" &&
      lobby.settings.mode !== "vamp"
    ? createRoundSummary()
    : undefined;

  // Handle captains draft phases
  const inFirstCaptainsRound = !canceled &&
    !lobby.round.practice &&
    lobby.captainsDraft?.phase === "drafted";

  const inSecondCaptainsRound = !canceled &&
    !lobby.round.practice &&
    lobby.captainsDraft?.phase === "reversed";

  if (inFirstCaptainsRound) {
    // After first round: swap teams and move to "reversed" phase
    for (const player of lobby.players) {
      if (player.team === "sheep") player.team = "wolf";
      else if (player.team === "wolf") player.team = "sheep";
    }

    const sheepCount = Array.from(lobby.players).filter((p) =>
      p.team === "sheep"
    ).length;
    lobby.settings.sheep = sheepCount;

    lobby.captainsDraft!.phase = "reversed";
  } else if (inSecondCaptainsRound) {
    // After second round: clear captains draft
    lobby.captainsDraft = undefined;
  }

  // Sync sheepCount from ECS entities back to Client objects (before clearing round)
  if (!canceled) {
    for (const player of lobby.players) {
      const ecsPlayer = getPlayer(player.id);
      if (ecsPlayer?.sheepCount !== undefined) {
        player.sheepCount = ecsPlayer.sheepCount;
      }
    }
  }

  // Don't want to clear the round in middle of a cycle
  queueMicrotask(() => {
    clearUpdatesCache();
    lobby.round = undefined;
  });

  lobby.status = "lobby";
  if (round) lobby.rounds.push(round);

  send({ type: "stop", updates: Array.from(lobby.players), round });

  if (inFirstCaptainsRound || inSecondCaptainsRound) {
    send({
      type: "captainsDraft",
      phase: inSecondCaptainsRound ? undefined : "reversed",
    });
    send({ type: "lobbySettings", ...serializeLobbySettings(lobby) });
  }

  if (canceled && !wasPractice) {
    send({ type: "chat", message: "Round canceled." });
  }
};

export const send = (message: ServerToClientMessage) => {
  const lobby = lobbyContext.current;
  // console.log("S->Cs", message, lobby?.players.size, lobby?.name);
  try {
    const serialized = JSON.stringify(message);
    for (const p of lobby.players) p.rawSend(serialized);
  } catch (err) {
    console.dir(message, { depth: 10 });
    throw err;
  }
};

/** Sends full lobby state to a joining client */
export const sendJoinMessage = (client: Client) => {
  const lobby = lobbyContext.current;

  // Check if lobby is using a custom map and send it to the joining client
  const mapId = lobby.settings.map;
  if (mapId.startsWith("local:")) {
    const customMapData = getCustomMapForLobby(lobby, mapId);
    if (customMapData) {
      client.send({
        type: "uploadCustomMap",
        mapId,
        mapData: customMapData,
      });
    }
  }

  client.send({
    type: "join",
    lobby: lobby.name,
    status: lobby.status,
    updates: lobby.round
      ? Array.from(lobby.round.ecs.entities)
      : Array.from(lobby.players),
    rounds: lobby.rounds,
    lobbySettings: serializeLobbySettings(lobby),
    localPlayer: client.id,
    captainsDraft: serializeCaptainsDraft(lobby.captainsDraft),
  });
};

/** Causes the local player to leave their current lobby. */
export const leave = (client?: Client) => {
  client ??= clientContext.current;
  console.log(new Date(), "Client", client.id, "left");
  const lobby = lobbyContext.current;

  // Distribute gold to allies if player is leaving during a game (non-practice)
  if (
    lobby.round && !isPractice() && client.team
  ) {
    const leavingPlayerGold = getPlayer(client.id)?.gold ?? 0;

    if (leavingPlayerGold > 0) {
      // Get surviving allies from same team
      let survivingAllies: Entity[] = [];
      if (client.team === "sheep") {
        survivingAllies = Array.from(getSheep())
          .filter((s) => s.health && s.health > 0 && s.owner !== client.id);
      } else if (client.team === "wolf") {
        // For wolves, find wolf units owned by players still in the wolves team
        for (const wolfPlayer of lobby.players) {
          if (wolfPlayer === client || wolfPlayer.team !== "wolf") continue;
          const wolfUnit = findPlayerUnit(
            wolfPlayer.id,
            (e) => e.prefab === "wolf",
          );
          if (wolfUnit) survivingAllies.push(wolfUnit);
        }
      }

      if (survivingAllies.length > 0) {
        const currentGold = survivingAllies.map((ally) =>
          getPlayer(ally.owner)?.gold ?? 0
        );
        const shares = distributeEquitably(leavingPlayerGold, currentGold);

        for (let i = 0; i < survivingAllies.length; i++) {
          const ally = survivingAllies[i];
          const share = shares[i];
          if (!ally.owner || share === 0) continue;

          sendPlayerGold(client.id, ally.owner, share);
        }
      }
    }
  }

  // Clean up player entities (including sheep and spirits)
  if (lobby.round?.ecs) {
    // Collect entities first to avoid iterator invalidation during removal
    const entities = Array.from(getPlayerUnits(client.id));
    for (const entity of entities) {
      lobby.round.ecs.removeEntity(entity);
    }
    lobby.round.ecs.removeEntity(client);
  }

  lobby.players.delete(client);

  // Kill the lobby
  if (lobby.players.size === 0) return deleteLobby(lobby);

  // Elevate new host
  if (lobby.host === client) {
    const next = lobby.players.values().next();
    if (next.done) throw new Error("Expected lobby to be non-empty");
    lobby.host = next.value;
  }

  // Handle captains draft when a non-observer player leaves during active draft
  if (isActiveCaptainsDraft(lobby) && client.team !== "observer") {
    handleCaptainsPlayerLeave(lobby, client.id);
  }

  // Send leave event
  send({
    type: "leave",
    updates: lobby.round
      ? flushUpdates(false)
      : [{ id: client.id, __delete: true }],
    lobbySettings: serializeLobbySettings(lobby),
  });

  // End round if team now empty (but not in practice mode)
  if (lobby.round && client.team && !lobby.round.practice) {
    const sheep = Array.from(lobby.players).filter((p) =>
      p.team === "sheep" && p !== client
    );
    const wolves = Array.from(lobby.players).filter((p) =>
      p.team === "wolf" && p !== client
    );
    if (
      sheep.length === 0 || wolves.length === 0 ||
      lobby.round.vip === client.id
    ) endRound(!lobby.round.start || Date.now() - lobby.round.start < 10_000);
  }

  // Remove lobby reference and return client to hub
  client.lobby = undefined;
  joinHub(client);

  // Update lobby list for hub
  broadcastLobbyList();

  // Update shard list (player set changed, may affect auto-select)
  broadcastShards(lobby);
};
