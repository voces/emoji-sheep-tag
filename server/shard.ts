import {
  ServerToShardMessage,
  ShardToServerMessage,
  zServerToShardMessage,
} from "@/shared/shard.ts";
import { ShardLobby } from "./shard/shardLobby.ts";
import { GameClient, setupGameClientHandlers } from "./shard/gameClient.ts";
import {
  WS_CLOSE_INVALID_TOKEN,
  WS_CLOSE_LOBBY_NOT_FOUND,
  WS_CLOSE_MISSING_PARAMS,
} from "./util/socketHandler.ts";

// Shard configuration from environment variables
const SHARD_NAME = Deno.env.get("SHARD_NAME"); // Optional - derived from hostname/IP by primary if not provided
const SHARD_PORT = parseInt(Deno.env.get("SHARD_PORT") || "");
const PRIMARY_SERVER = Deno.env.get("PRIMARY_SERVER") || "wss://est.w3x.io";
const FLY_MACHINE_ID = Deno.env.get("FLY_MACHINE_ID");
const FLY_APP_NAME = Deno.env.get("FLY_APP_NAME");

// Build public URL with machine ID for fly-replay routing
const getPublicUrl = (): string | undefined => {
  const explicit = Deno.env.get("SHARD_PUBLIC_URL");
  if (explicit) return explicit;

  // On Fly.io, use the app URL with machine param for fly-replay routing
  if (FLY_APP_NAME && FLY_MACHINE_ID) {
    return `wss://${FLY_APP_NAME}.fly.dev?machine=${FLY_MACHINE_ID}`;
  }

  return undefined;
};

const SHARD_PUBLIC_URL = getPublicUrl();

if (!SHARD_PORT) {
  throw new Error("SHARD_PORT environment variable required");
}

let primarySocket: WebSocket | undefined;
let shardId: string | undefined;
let reconnectTimeout: number | undefined;

// Active lobbies on this shard (indexed by ID for connection routing)
const shardLobbies = new Map<string, ShardLobby>();

const reportStatus = () => {
  let playerCount = 0;
  for (const lobby of shardLobbies.values()) {
    playerCount += lobby.clients.size;
  }
  sendToPrimary({
    type: "status",
    lobbies: shardLobbies.size,
    players: playerCount,
  });
};

const sendToPrimary = (message: ShardToServerMessage) => {
  if (primarySocket?.readyState !== WebSocket.OPEN) return;
  try {
    primarySocket.send(JSON.stringify(message));
  } catch (err) {
    console.error(new Date(), "Error sending to primary:", err);
  }
};

const connectToPrimary = () => {
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = undefined;
  }

  console.log(
    new Date(),
    `Connecting to primary server at ${PRIMARY_SERVER}...`,
  );
  primarySocket = new WebSocket(`${PRIMARY_SERVER}/shard`);

  primarySocket.addEventListener("open", () => {
    console.log(
      new Date(),
      "Connected to primary server, registering...",
    );
    sendToPrimary({
      type: "register",
      name: SHARD_NAME,
      port: SHARD_PORT,
      publicUrl: SHARD_PUBLIC_URL,
    });
  });

  primarySocket.addEventListener("message", (e) => {
    if (typeof e.data !== "string") return;

    let message: ServerToShardMessage;
    try {
      message = zServerToShardMessage.parse(JSON.parse(e.data));
    } catch (err) {
      console.error(new Date(), "Invalid message from primary:", err);
      return;
    }

    switch (message.type) {
      case "registered":
        shardId = message.shardId;
        console.log(new Date(), `Registered with ID: ${shardId}`);
        break;

      case "rejected":
        console.error(
          new Date(),
          `Registration rejected: ${message.reason}`,
        );
        primarySocket?.close();
        break;

      case "assignLobby": {
        console.log(
          new Date(),
          `Assigned lobby: ${message.lobbyId}`,
        );

        const lobby = new ShardLobby(message);
        shardLobbies.set(message.lobbyId, lobby);

        // When lobby ends, notify primary and clean up
        lobby.onEnd = (round, canceled, practice) => {
          sendToPrimary({
            type: "lobbyEnded",
            lobbyId: message.lobbyId,
            canceled,
            practice,
            round,
          });
          shardLobbies.delete(message.lobbyId);
          reportStatus();
        };

        reportStatus();
        break;
      }
    }
  });

  primarySocket.addEventListener("close", () => {
    console.log(new Date(), "Disconnected from primary server");
    shardId = undefined;
    // Attempt to reconnect after 5 seconds
    reconnectTimeout = setTimeout(connectToPrimary, 5000);
  });

  primarySocket.addEventListener("error", (e) => {
    console.error(
      new Date(),
      "WebSocket error:",
      "error" in e ? e.error : e,
    );
  });
};

// Start the shard server for player connections
Deno.serve({
  port: SHARD_PORT,
  onListen: (addr) => {
    console.log(
      new Date(),
      `Listening on ${addr.hostname}:${addr.port}`,
    );
    // Connect to primary server after local server is ready
    connectToPrimary();
  },
}, (req) => {
  const url = new URL(req.url);

  // Fly.io fly-replay routing: if request has a machine param that doesn't match us, replay to correct machine
  const targetMachine = url.searchParams.get("machine");
  if (targetMachine && FLY_MACHINE_ID && targetMachine !== FLY_MACHINE_ID) {
    return new Response("Replaying to correct machine", {
      status: 307,
      headers: { "fly-replay": `instance=${targetMachine}` },
    });
  }

  if (req.headers.get("upgrade") === "websocket") {
    const { socket, response } = Deno.upgradeWebSocket(req);

    const isHealthCheck = url.searchParams.has("healthcheck");

    // Health check from primary server - close cleanly after open
    if (isHealthCheck) {
      socket.addEventListener("open", () => {
        socket.close(1000, "Health check OK");
      });
      return response;
    }

    const token = url.searchParams.get("token");
    const lobbyId = url.searchParams.get("lobby");

    if (!token || !lobbyId) {
      socket.addEventListener("open", () => {
        socket.close(WS_CLOSE_MISSING_PARAMS, "Missing token or lobby");
      });
      return response;
    }

    const lobby = shardLobbies.get(lobbyId);
    if (!lobby) {
      socket.addEventListener("open", () => {
        socket.close(WS_CLOSE_LOBBY_NOT_FOUND, "Lobby not found");
      });
      return response;
    }

    const playerInfo = lobby.authenticatePlayer(token);
    if (!playerInfo) {
      socket.addEventListener("open", () => {
        socket.close(WS_CLOSE_INVALID_TOKEN, "Invalid or expired token");
      });
      return response;
    }

    console.log(
      new Date(),
      `Player ${playerInfo.name} connected to lobby ${lobby.name}`,
    );

    const client = new GameClient(socket, lobby, playerInfo);
    setupGameClientHandlers(client);

    socket.addEventListener("open", () => {
      lobby.addClient(client);
      reportStatus();
    });

    return response;
  }

  // Health check endpoint
  if (url.pathname === "/health") {
    return new Response(
      JSON.stringify({
        status: "ok",
        shardId,
        machineId: FLY_MACHINE_ID,
        publicUrl: SHARD_PUBLIC_URL,
        connected: primarySocket?.readyState === WebSocket.OPEN,
      }),
      { headers: { "content-type": "application/json" } },
    );
  }

  return new Response("Not found", { status: 404 });
});
