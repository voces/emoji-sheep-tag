import { z } from "npm:zod";
import type { ServerToClientMessage } from "../client/client.ts";
import { lobbies, type Lobby, newLobby } from "./lobby.ts";
import { clientContext, lobbyContext } from "./contexts.ts";
import { Entity, newEcs } from "./ecs.ts";
import { interval, leave, newUnit, send, timeout } from "./lobbyApi.ts";
import { unitData } from "../shared/data.ts";

const colors: string[] = [
  "#FF0303",
  "#0042FF",
  "#1CE6B9",
  "#540081",
  "#FFFC01",
  "#fEBA0E",
  "#20C000",
  "#E55BB0",
  "#959697",
  "#7EBFF1",
  "#106246",
  "#4E2A04",
  "#9c0000",
  "#0000c3",
  "#00ebff",
  "#bd00ff",
  "#ecce87",
  "#f7a58b",
  "#bfff81",
  "#dbb8eb",
  "#4f5055",
  "#ecf0ff",
  "#00781e",
  "#a56f34",
];

const wrap = <T extends (...args: any[]) => unknown>(
  client: Client,
  fn: (...args: Parameters<T>) => ReturnType<T>,
) =>
(...args: Parameters<T>) => {
  if (client.lobby) {
    return lobbyContext.with(
      client.lobby!,
      () => clientContext.with(client, () => fn(...args)),
    );
  }
  return clientContext.with(client, () => fn(...args));
};

let clientIndex = 0;
export class Client {
  id: string;
  name: string;
  color: string;

  lobby?: Lobby;

  constructor(readonly socket: WebSocket) {
    this.color = colors[clientIndex % colors.length];
    this.id = `player-${clientIndex++}`;
    this.name = `Player ${clientIndex}`;
  }

  send(message: ServerToClientMessage) {
    try {
      this.socket.send(JSON.stringify(message));
    } catch (err) {
      console.error(err);
    }
  }
}

const zStart = z.object({ type: z.literal("start") });
const zMove = z.object({
  type: z.literal("move"),
  units: z.string().array(),
  x: z.number(),
  y: z.number(),
});
const zBuild = z.object({
  type: z.literal("build"),
  unit: z.string(),
  buildType: z.string(), // literal
  x: z.number(),
  y: z.number(),
});
const zClientToServerMessage = z.union([zStart, zMove, zBuild]);

export type ClientToServerMessage = z.TypeOf<typeof zClientToServerMessage>;

const handlers = {
  start: (client: Client) => {
    const lobby = client.lobby;
    if (
      !lobby || lobby.host !== client ||
      lobby.status === "playing"
    ) return;
    lobby.status = "playing";
    const sheep = new Set<Client>();
    const wolves = new Set<Client>();
    const pool = Array.from(lobby.players);
    for (const player of pool) {
      if (!sheep.size) sheep.add(player);
      else if (sheep.size + 1 < wolves.size) sheep.add(player);
      else wolves.add(player);
    }
    const { ecs, lookup } = newEcs();
    lobby.round = {
      sheep,
      wolves,
      ecs,
      lookup,
      clearInterval: interval(() => ecs.update(), 50),
    };

    lobbyContext.with(lobby, () => {
      send({
        type: "start",
        sheep: Array.from(sheep, (c) => c.id),
        wolves: Array.from(wolves, (c) => c.id),
      });

      timeout(() => {
        const lobby = lobbyContext.context;
        if (!lobby.round) return;
        for (const owner of sheep) {
          console.log("adding sheep");
          lobby.round.ecs.add({
            unitType: "sheep",
            owner: owner.id,
            position: { x: 1, y: -4 },
            movementSpeed: unitData.sheep?.movementSpeed,
          });
        }

        timeout(() => {
          const lobby = lobbyContext.context;
          if (!lobby.round) return;
          for (const owner of wolves) {
            lobby.round.ecs.add({
              unitType: "wolf",
              owner: owner.id,
              position: { x: 0, y: 0 },
              movementSpeed: unitData.wolf?.movementSpeed,
            });
          }
        }, 2000);
      }, 300);
    });
  },
  move: (client: Client, { units, x, y }: z.TypeOf<typeof zMove>) => {
    const round = lobbyContext.context.round;
    if (!round) return;
    const movedUnits = units
      .map((u) => round.lookup[u])
      .filter((e: Entity | undefined): e is Entity =>
        !!e && e.owner === client.id
      );
    if (!movedUnits.length) return console.log("no units!");
    movedUnits.forEach((u) => {
      // Interrupt
      console.log("interrupt?");
      delete u.queue;
      console.log("set?");
      u.action = { type: "walk", target: { x, y } };
      console.log("set!", u);
    });
  },
  build: (client: Client, { buildType, x, y }: z.TypeOf<typeof zBuild>) => {
    newUnit(client.id, buildType, x, y);
    // for (const c of (client.lobby?.players ?? [])) {
    // c.send({
    //     type: "unit",
    //     id: data.unit,
    //     movement: [{ x: data.x, y: data.y }],
    //   }],
    // });
    // }
  },
};

export const handleSocket = (socket: WebSocket) => {
  const client = new Client(socket);

  clientContext.with(client, () => {
    if (lobbies.size) {
      const result = lobbies.values().next();
      if (result.done) throw new Error("Expected lobby");
      const lobby = client.lobby = result.value;
      lobbyContext.with(client.lobby, () => {
        lobby.settings.teams.set(client, "pending");
        send({
          type: "join",
          status: lobby.status,
          players: [{
            id: client.id,
            name: client.name,
            color: client.color,
            team: "pending",
          }],
          updates: [],
        });
        lobby.players.add(client);
      });
    } else {
      const lobby = client.lobby = newLobby();
      lobbyContext.with(lobby, () => {
        lobby.players.add(client);
        lobby.host = client;
        console.log("Client made host", lobby.name, client.id);
      });
    }
  });

  socket.addEventListener(
    "open",
    wrap(client, () => {
      if (!client.lobby) return;
      client.send({
        type: "join",
        status: client.lobby.status,
        players: Array.from(
          client.lobby.players,
          (p) => ({
            id: p.id,
            name: p.name,
            color: p.color,
            team: client.lobby!.settings.teams.get(client)! ?? "pending",
            local: p === client ? true : undefined,
          }),
        ),
        updates: Array.from(
          client.lobby.round?.ecs.entities ?? [],
          (e) => ({ type: "unit", ...e }),
        ),
      });
    }),
  );

  socket.addEventListener(
    "message",
    wrap(client, (e) => {
      try {
        const json = JSON.parse(e.data);
        const message = zClientToServerMessage.parse(json);

        clientContext.with(
          client,
          () => handlers[message.type](client, message as any),
        );
      } catch (err) {
        console.error(err);
        clientContext.with(client, () => leave());
      }
    }),
  );

  socket.addEventListener("close", wrap(client, () => leave()));
};
