import { ServerToClientMessage } from "../client/client.ts";
import { Client } from "./client.ts";
import { clientContext, lobbyContext } from "./contexts.ts";
import { deleteLobby } from "./lobby.ts";
import { clearUpdates } from "./updates.ts";

export const endRound = () => {
  const lobby = lobbyContext.context;
  console.log(new Date(), "Round ended in lobby", lobby.name);
  lobby.round?.clearInterval();
  // Don't want to clear the round in middle of a cycle
  queueMicrotask(() => lobby.round = undefined);
  lobby.status = "lobby";
  clearUpdates();
  send({ type: "stop" });
};

export const send = (message: ServerToClientMessage) => {
  const lobby = lobbyContext.context;
  // console.log("S->Cs", message, lobby?.players.size, lobby?.name);
  const serialized = JSON.stringify(message);
  for (const p of lobby.players) p.rawSend(serialized);
};

/** Causes the local player to leave their current lobby. */
export const leave = (client?: Client) => {
  client ??= clientContext.context;
  console.log(new Date(), "Client", client.id, "left");
  const lobby = lobbyContext.context;
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
  send({ type: "leave", player: client.id, host: lobby.host?.id });

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
