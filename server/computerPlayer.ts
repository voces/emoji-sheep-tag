import { colors } from "@/shared/data.ts";
import type { Lobby } from "./lobby.ts";
import { setSome } from "./util/set.ts";
import type { Entity } from "@/shared/types.ts";
import type { ServerToClientMessage } from "../client/client.ts";
import type { Socket } from "./util/socketHandler.ts";

let computerIndex = 0;

const stubSocket: Socket = {
  readyState: WebSocket.CLOSED,
  send: () => {},
  close: () => {},
  addEventListener: () => {},
};

// ComputerPlayer mimics the Client interface but doesn't extend it to avoid circular imports.
// It has no-op send methods since computer players don't have real network connections.
export class ComputerPlayer implements Entity {
  id: string;
  name: string;
  playerColor: string;
  isPlayer: true = true;
  isComputer: true = true;
  team: "sheep" | "wolf" | "pending" | "observer" = "pending";
  handicap?: number;
  sheepCount = 0;
  lobby?: Lobby;
  startLocation?: { x: number; y: number; map: string };
  socket!: Socket;
  ip?: string;

  constructor(lobby: Lobby) {
    const index = ++computerIndex;
    this.id = `computer-${index}`;
    this.name = `Computer ${index}`;

    // Assign first available color
    this.playerColor =
      colors.find((c) => !setSome(lobby.players, (p) => p.playerColor === c)) ??
        colors[0];

    // Make non-enumerable properties to prevent JSON serialization issues
    Object.defineProperty(this, "lobby", {
      value: lobby,
      writable: true,
      enumerable: false,
      configurable: true,
    });

    Object.defineProperty(this, "startLocation", {
      value: undefined,
      writable: true,
      enumerable: false,
      configurable: true,
    });

    Object.defineProperty(this, "socket", {
      value: stubSocket,
      writable: false,
      enumerable: false,
      configurable: false,
    });

    Object.defineProperty(this, "ip", {
      value: undefined,
      writable: false,
      enumerable: false,
      configurable: false,
    });
  }

  // No-op send methods (computer players don't have network connections)
  send(_message: ServerToClientMessage) {}
  rawSend(_message: string) {}
}

export const isComputerPlayer = (entity: Entity): entity is ComputerPlayer =>
  "isComputer" in entity && entity.isComputer === true;
