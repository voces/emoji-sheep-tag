import { ServerToClientMessage } from "../client/client.ts";
import { Client } from "./client.ts";
import { clientContext, lobbyContext } from "./contexts.ts";
import { deleteLobby } from "./lobby.ts";
import { computeDesiredFormat } from "./util/computeDesiredFormat.ts";

export const endRound = (canceled = false) => {
  const lobby = lobbyContext.context;
  if (!lobby.round) return;
  console.log(new Date(), "Round ended in lobby", lobby.name);
  lobby.round.clearInterval();

  // Clean up player entity references
  for (const player of lobby.players) player.playerEntity = undefined;

  // Don't want to clear the round in middle of a cycle
  queueMicrotask(() => lobby.round = undefined);
  lobby.status = "lobby";
  const round = {
    sheep: Array.from(lobby.round.sheep, (p) => p.id),
    wolves: Array.from(lobby.round.wolves, (p) => p.id),
    duration: Date.now() - lobby.round.start,
  };
  if (!canceled) lobby.rounds.push(round);
  send({
    type: "stop",
    players: canceled
      ? Array.from(
        lobby.players,
        (p) => ({ id: p.id, sheepCount: p.sheepCount }),
      )
      : undefined,
    round: canceled ? undefined : round,
  });
};

export const send = (message: ServerToClientMessage) => {
  const lobby = lobbyContext.context;
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
  client ??= clientContext.context;
  console.log(new Date(), "Client", client.id, "left");
  const lobby = lobbyContext.context;

  // Clean up player entity reference
  if (client.playerEntity && lobby.round?.ecs) {
    lobby.round.ecs.removeEntity(client.playerEntity);
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
    format: computeDesiredFormat(lobby),
  });

  // Make player leave lobby
  if (
    lobby.round &&
    (lobby.round.sheep.has(client) || lobby.round?.wolves.has(client))
  ) {
    lobby.round.sheep.delete(client);
    lobby.round.wolves.delete(client);

    // End round if team now empty
    if (
      lobby.round.sheep.size === 0 ||
      lobby.round.wolves.size === 0
    ) endRound();
  }
};
