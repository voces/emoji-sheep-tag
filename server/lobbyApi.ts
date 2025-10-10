import { ServerToClientMessage } from "../client/client.ts";
import { Client } from "./client.ts";
import { clientContext, lobbyContext } from "./contexts.ts";
import { deleteLobby } from "./lobby.ts";
import { clearUpdatesCache } from "./updates.ts";
import { serializeLobbySettings } from "./actions/lobbySettings.ts";
import { findPlayerUnit, getPlayerUnits } from "./systems/playerEntities.ts";
import { getPlayer, sendPlayerGold } from "./api/player.ts";
import { getSheep } from "./systems/sheep.ts";
import { distributeEquitably } from "./util/equitableDistribution.ts";
import { isPractice } from "./api/st.ts";
import { broadcastLobbyList, joinHub } from "./hub.ts";

export const endRound = (canceled = false) => {
  const lobby = lobbyContext.current;
  if (!lobby.round) return;
  console.log(new Date(), "Round ended in lobby", lobby.name);
  lobby.round.clearInterval();

  // Clean up player entity references
  for (const player of lobby.players) player.playerEntity = undefined;

  // Don't want to clear the round in middle of a cycle
  queueMicrotask(() => {
    clearUpdatesCache();
    lobby.round = undefined;
  });
  lobby.status = "lobby";
  const round = {
    sheep: Array.from(lobby.round.sheep, (p) => p.id),
    wolves: Array.from(lobby.round.wolves, (p) => p.id),
    duration: Date.now() - lobby.round.start,
  };
  if (!canceled && !lobby.round.practice) lobby.rounds.push(round);
  send({
    type: "stop",
    players: canceled && !lobby.round.practice
      ? Array.from(
        lobby.players,
        (p) => ({ id: p.id, sheepCount: p.sheepCount }),
      )
      : undefined,
    round: canceled || lobby.round.practice ? undefined : round,
  });
  if (canceled) send({ type: "chat", message: "Round canceled." });
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

/** Causes the local player to leave their current lobby. */
export const leave = (client?: Client) => {
  client ??= clientContext.current;
  console.log(new Date(), "Client", client.id, "left");
  const lobby = lobbyContext.current;

  // Distribute gold to allies if player is leaving during a game (non-practice)
  if (
    lobby.round && !isPractice() &&
    (lobby.round.sheep.has(client) || lobby.round.wolves.has(client))
  ) {
    const isSheep = lobby.round.sheep.has(client);
    const leavingPlayerGold = getPlayer(client.id)?.gold ?? 0;

    if (leavingPlayerGold > 0) {
      // Get surviving allies from same team
      let survivingAllies;
      if (isSheep) {
        survivingAllies = Array.from(getSheep())
          .filter((s) => s.health && s.health > 0 && s.owner !== client.id);
      } else {
        // For wolves, find wolf units owned by players still in the wolves team
        survivingAllies = [];
        for (const wolfPlayer of lobby.round.wolves) {
          if (wolfPlayer === client) continue;
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
    // Remove all entities owned by this player (sheep, spirits, etc.)
    for (const entity of getPlayerUnits(client.id)) {
      lobby.round.ecs.removeEntity(entity);
    }
    client.playerEntity = undefined;
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

  // Send leave event
  send({
    type: "leave",
    player: client.id,
    host: lobby.host?.id,
    lobbySettings: serializeLobbySettings(lobby),
  });

  // Make player leave lobby
  if (
    lobby.round &&
    (lobby.round.sheep.has(client) || lobby.round?.wolves.has(client))
  ) {
    lobby.round.sheep.delete(client);
    lobby.round.wolves.delete(client);

    // End round if team now empty (but not in practice mode)
    if (!lobby.round.practice) {
      if (
        lobby.round.sheep.size === 0 ||
        lobby.round.wolves.size === 0
      ) endRound();
    }
  }

  // Remove lobby reference and return client to hub
  client.lobby = undefined;
  joinHub(client);

  // Update lobby list for hub
  broadcastLobbyList();
};
