import { ServerToClientMessage } from "../client/client.ts";
import { Client } from "./client.ts";
import { clientContext, lobbyContext } from "./contexts.ts";
import { deleteLobby } from "./lobby.ts";

export const endRound = () => {
  const lobby = lobbyContext.context;
  lobby.round = undefined;
  lobby.status = "lobby";
};

export const send = (message: ServerToClientMessage) => {
  const lobby = lobbyContext.context;
  const serialized = JSON.stringify(message);
  for (const p of lobby.players) {
    try {
      if (p.socket.readyState === WebSocket.OPEN) p.socket.send(serialized);
    } catch (err) {
      console.error(err);
      p.socket.close();
    }
  }
};

/** Causes the local player to leave their current lobby. */
export const leave = (client?: Client) => {
  client ??= clientContext.context;
  console.log("leave", client);
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
  send({ type: "leave", player: client.id });

  // Make player leave lobby
  if (lobby.round) {
    lobby.round.sheep.delete(client);
    lobby.round.wolves.delete(client);

    // End round if team now empty
    if (
      lobby.round.sheep.size === 0 ||
      lobby.round.wolves.size === 0
    ) endRound();
  }
};

export const timeout = (cb: () => void, timeout: number) => {
  const lobby = lobbyContext.context;
  const client = clientContext.context;
  const t = setTimeout(
    () => lobbyContext.with(lobby, () => clientContext.with(client, cb)),
    timeout,
  );
  return () => clearTimeout(t);
};

export const interval = (cb: () => void, interval: number) => {
  const lobby = lobbyContext.context;
  const client = clientContext.context;
  const i = setInterval(
    () => lobbyContext.with(lobby, () => clientContext.with(client, cb)),
    interval,
  );
  return () => clearInterval(i);
};

export const newUnit = (owner: string, type: string, x: number, y: number) => {
  const ecs = lobbyContext.context.round?.ecs;
  if (!ecs) return;
  ecs.add({
    unitType: type,
    owner,
    position: { x, y },
  });
};
