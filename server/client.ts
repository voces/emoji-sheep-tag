import { z } from "npm:zod";
import type { ServerToClientMessage } from "../client/client.ts";

const clients = new Set<Client>();

class Client {
  constructor(readonly socket: WebSocket) {}

  send(message: ServerToClientMessage) {
    if (this.socket.readyState !== WebSocket.OPEN) return;
    try {
      this.socket.send(JSON.stringify(message));
    } catch (err) {
      console.error(err);
      clients.delete(this);
    }
  }
}

const zClientToServerMessage = z.union([
  z.object({
    type: z.literal("move"),
    units: z.string().array(),
    x: z.number(),
    y: z.number(),
  }),
  z.object({
    type: z.literal("build"),
    unit: z.string(),
    buildType: z.string(), // literal
    x: z.number(),
    y: z.number(),
  }),
]);

export type ClientToServerMessage = z.TypeOf<typeof zClientToServerMessage>;

export const handleSocket = (socket: WebSocket) => {
  const client = new Client(socket);

  clients.add(client);

  socket.addEventListener("open", () => {
    client.send({
      type: "join",
      players: [{
        id: "player-0",
        name: "verit",
        color: "#ff0000",
        team: "pending",
      }, {
        id: "player-1",
        name: "other",
        color: "#0000ff",
        team: "pending",
      }],
    });

    setTimeout(
      () =>
        client.send({
          type: "start",
          sheep: ["player-0"],
          wolves: ["player-1"],
        }),
      100,
    );

    setTimeout(() =>
      client.send({
        type: "updates",
        updates: [{
          type: "newUnit",
          id: "sheep-0",
          kind: "sheep",
          owner: "player-0",
          facing: 0,
          movement: [{ x: 1, y: -4 }],
        }],
      }), 400);
  });

  socket.addEventListener("message", (e) => {
    try {
      const json = JSON.parse(e.data);
      const message = zClientToServerMessage.parse(json);

      if (message.type === "move") {
        for (const client of clients) {
          client.send({
            type: "updates",
            updates: message.units.map((id) => ({
              type: "updateUnit",
              id,
              movement: [{ x: message.x, y: message.y }],
            })),
          });
        }
      } else if (message.type === "build") {
        for (const client of clients) {
          client.send({
            type: "updates",
            updates: [{
              type: "newUnit",
              id: crypto.randomUUID(),
              kind: message.buildType as "hut",
              owner: "player-0",
              facing: 0,
              movement: [{ x: message.x, y: message.y }],
            }, {
              type: "updateUnit",
              id: message.unit,
              movement: [{ x: message.x, y: message.y }],
            }],
          });
        }
      }
    } catch (err) {
      console.error(err);
      clients.delete(client);
    }
  });
};
