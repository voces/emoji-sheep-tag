import { afterAll, afterEach, beforeAll, describe, it } from "@std/testing/bdd";
import { expect } from "@std/expect";
import type {
  ServerToShardMessage,
  ShardToServerMessage,
} from "@/shared/shard.ts";
import { waitFor } from "@/shared/util/test/waitFor.ts";
import { getShard, getShards, handleShardSocket } from "./shardRegistry.ts";
import { lobbies, newLobby } from "./lobby.ts";
import { ComputerPlayer } from "./computerPlayer.ts";
import type { Socket, SocketEventMap } from "./util/socketHandler.ts";

type Listener = (ev: SocketEventMap[keyof SocketEventMap]) => void;

const connectShard = () => {
  const listeners = new Map<keyof SocketEventMap, Listener>();
  const received: ServerToShardMessage[] = [];
  const socket: Socket = {
    readyState: WebSocket.OPEN,
    send: (data) => received.push(JSON.parse(data)),
    close: () => {},
    addEventListener: (type, listener) =>
      listeners.set(
        type,
        (ev) => listener.call(socket, ev as SocketEventMap[typeof type]),
      ),
  };
  handleShardSocket(socket, "127.0.0.1", false);
  return {
    received,
    send: (message: ShardToServerMessage) =>
      listeners.get("message")?.({ data: JSON.stringify(message) }),
    close: () => {
      if (socket.readyState === WebSocket.CLOSED) return;
      socket.readyState = WebSocket.CLOSED;
      listeners.get("close")?.(undefined);
    },
  };
};

type ShardConnection = ReturnType<typeof connectShard>;

describe(
  "handleShardSocket",
  { sanitizeOps: false, sanitizeResources: false },
  () => {
    let healthServer: Deno.HttpServer<Deno.NetAddr>;
    let publicUrl: string;
    const connections: ShardConnection[] = [];

    const register = async (name: string, url = publicUrl) => {
      const shard = connectShard();
      connections.push(shard);
      shard.send({ type: "register", port: 0, publicUrl: url, name });
      const reply = await waitFor(() => {
        const message = shard.received.find((m) =>
          m.type === "registered" || m.type === "rejected"
        );
        if (!message) throw new Error("no reply yet");
        return message;
      });
      return { ...shard, reply };
    };

    beforeAll(() => {
      healthServer = Deno.serve(
        { port: 0, hostname: "127.0.0.1", onListen: () => {} },
        (req) =>
          new URL(req.url).pathname === "/unreachable"
            ? new Response(null, { status: 404 })
            : Deno.upgradeWebSocket(req).response,
      );
      publicUrl = `ws://127.0.0.1:${healthServer.addr.port}`;
    });

    afterAll(() => healthServer.shutdown());

    afterEach(() => {
      for (const shard of connections.splice(0)) shard.close();
      lobbies.clear();
    });

    it("registers reachable shards and keeps their names unique", async () => {
      const first = await register("alpha");
      const second = await register("alpha");

      expect(first.reply.type).toBe("registered");
      expect(second.reply.type).toBe("registered");
      const ids = [first.reply, second.reply].map((r) =>
        r.type === "registered" ? r.shardId : ""
      );
      expect(ids.map((id) => getShard(id)?.name)).toEqual([
        "alpha",
        "alpha 2",
      ]);
    });

    it("rejects a shard whose public URL cannot be reached", async () => {
      const before = getShards().length;
      const shard = await register("unreachable", `${publicUrl}/unreachable`);

      expect(shard.reply.type).toBe("rejected");
      expect(getShards()).toHaveLength(before);
    });

    it("ignores lobby messages until the shard has registered", () => {
      const lobby = newLobby(undefined, true);
      const player = new ComputerPlayer(lobby);
      lobby.players.add(player);
      const shard = connectShard();
      connections.push(shard);

      shard.send({
        type: "updateStartLocation",
        lobbyId: lobby.name,
        playerId: player.id,
        startLocation: { x: 1, y: 2, map: "revo" },
      });

      expect(player.startLocation).toBeUndefined();
    });

    it("applies status, start locations and ended lobbies from a registered shard", async () => {
      const shard = await register("beta");
      const shardId = shard.reply.type === "registered"
        ? shard.reply.shardId
        : "";
      const lobby = newLobby(undefined, true);
      const player = new ComputerPlayer(lobby);
      lobby.players.add(player);

      shard.send({ type: "status", lobbies: 3, players: 7 });
      expect(getShard(shardId)).toMatchObject({
        lobbyCount: 3,
        playerCount: 7,
      });

      shard.send({
        type: "updateStartLocation",
        lobbyId: lobby.name,
        playerId: player.id,
        startLocation: { x: 1, y: 2, map: "revo" },
      });
      expect(player.startLocation).toEqual({ x: 1, y: 2, map: "revo" });

      lobby.status = "playing";
      lobby.activeShard = shardId;
      getShard(shardId)!.lobbies.add(lobby.name);
      shard.send({ type: "lobbyEnded", lobbyId: lobby.name, canceled: true });

      expect(lobby.status).toBe("lobby");
      expect(lobby.activeShard).toBeUndefined();
      expect(getShard(shardId)!.lobbies.size).toBe(0);
    });

    it("cancels the shard's rounds and forgets it when it disconnects", async () => {
      const shard = await register("gamma");
      const shardId = shard.reply.type === "registered"
        ? shard.reply.shardId
        : "";
      const lobby = newLobby(undefined, true);
      lobby.status = "playing";
      lobby.activeShard = shardId;
      getShard(shardId)!.lobbies.add(lobby.name);

      shard.close();

      expect(lobby.status).toBe("lobby");
      expect(lobby.activeShard).toBeUndefined();
      expect(getShard(shardId)).toBeUndefined();
    });
  },
);
