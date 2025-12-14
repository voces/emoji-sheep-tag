import type { z } from "zod";
import type { zServerToShardMessage } from "@/shared/shard.ts";
import type { GameClient } from "./gameClient.ts";
import type { CaptainsDraft, Round } from "../lobby.ts";
import { buildLoadedMap, type PackedMap } from "@/shared/map.ts";
import { getMapMeta } from "@/shared/maps/manifest.ts";
import { initializeGame } from "../st/gameStartHelpers.ts";
import { getPlayer } from "@/shared/api/player.ts";
import { appContext } from "@/shared/context.ts";
import { lobbyContext } from "../contexts.ts";
import { createRoundSummary } from "../lobbyApi.ts";

type AssignLobbyMessage = Extract<
  z.infer<typeof zServerToShardMessage>,
  { type: "assignLobby" }
>;

type PlayerInfo = AssignLobbyMessage["players"][number];

// Token expiration time (1 minute)
const TOKEN_EXPIRATION_MS = 60 * 1000;

export class ShardLobby {
  name: string;
  settings: AssignLobbyMessage["settings"];
  hostId: string | null;
  practice: boolean;
  editor: boolean;
  customMapData: unknown;
  captainsDraft?: CaptainsDraft;

  // Player management
  expectedPlayers: Map<string, PlayerInfo> = new Map(); // token -> player info
  clients: Map<string, GameClient> = new Map(); // player id -> client
  private tokenExpirationTimer?: number;

  get players(): Set<GameClient> {
    return new Set(this.clients.values());
  }
  get host(): GameClient | undefined {
    return this.hostId ? this.clients.get(this.hostId) : undefined;
  }
  status: "lobby" | "playing" = "playing";
  rounds: { sheep: string[]; wolves: string[]; duration: number }[] = [];

  round?: Round;
  onEnd?: (
    round?: { sheep: string[]; wolves: string[]; duration: number },
    canceled?: boolean,
  ) => void;

  /** Broadcast a message to all clients in this lobby */
  send(message: Parameters<GameClient["send"]>[0]) {
    for (const client of this.clients.values()) {
      client.send(message);
    }
  }

  constructor(assignment: AssignLobbyMessage) {
    this.name = assignment.lobbyId;
    this.settings = assignment.settings;
    this.hostId = assignment.hostId;
    this.practice = assignment.practice;
    this.editor = assignment.editor;
    this.customMapData = assignment.customMapData;

    // Index players by token for auth
    for (const p of assignment.players) {
      this.expectedPlayers.set(p.token, p);
    }

    // Set up token expiration cleanup
    this.tokenExpirationTimer = setTimeout(() => {
      if (this.expectedPlayers.size > 0) {
        console.log(
          new Date(),
          `Cleaning up ${this.expectedPlayers.size} expired tokens for ${this.name}`,
        );
        this.expectedPlayers.clear();
        // If no clients connected, clean up the lobby
        if (this.clients.size === 0) {
          this.cleanup();
        }
      }
    }, TOKEN_EXPIRATION_MS);
  }

  /** Authenticate a connecting player by token */
  authenticatePlayer(token: string): PlayerInfo | undefined {
    const player = this.expectedPlayers.get(token);
    if (player) {
      // Token is one-time use
      this.expectedPlayers.delete(token);
    }
    return player;
  }

  /** Add an authenticated client */
  addClient(client: GameClient) {
    this.clients.set(client.id, client);

    // Check if all expected players have connected
    if (this.expectedPlayers.size === 0 && !this.round) {
      // All players connected, start the game
      this.startGame();
    }
  }

  /** Remove a disconnected client */
  removeClient(client: GameClient) {
    this.clients.delete(client.id);

    // If all clients disconnect, end the lobby
    if (this.clients.size === 0) {
      this.cleanup();
    }
  }

  /** Read a packed map from disk */
  private readPackedMap(mapId: string): PackedMap {
    const meta = getMapMeta(mapId);
    if (!meta) throw new Error(`Unknown map id "${mapId}"`);
    const url = new URL(`../../shared/maps/${meta.file}.json`, import.meta.url);
    const text = Deno.readTextFileSync(url);
    return JSON.parse(text) as PackedMap;
  }

  /** Start the game using shared initialization logic */
  startGame() {
    const sheep: GameClient[] = [];
    const wolves: GameClient[] = [];

    // Group players by team from assignment
    for (const client of this.clients.values()) {
      if (client.team === "sheep") {
        sheep.push(client);
      } else if (client.team === "wolf") {
        wolves.push(client);
      }
    }

    console.log(
      new Date(),
      `${this.practice ? "Practice round" : "Round"} started in ${this.name}${
        this.practice
          ? ""
          : `. ${sheep.map((s) => s.name).join(", ")} vs ${
            wolves.map((w) => w.name).join(", ")
          }`
      }`,
    );

    // Create map - for custom maps, use the packed data directly
    const map = this.customMapData
      ? buildLoadedMap("custom", this.customMapData as PackedMap)
      : buildLoadedMap(
        this.settings.map,
        this.readPackedMap(this.settings.map),
      );

    // Initialize game using lobbyContext so APIs work correctly
    lobbyContext.with(this, () =>
      initializeGame({
        map,
        settings: this.settings,
        sheep,
        wolves,
        practice: this.practice,
        editor: this.editor,
        onSheepWin: () => {
          this.send({ type: "chat", message: "Sheep win!" });
          this.endRound();
        },
      }));
  }

  /** End the current round */
  endRound(canceled = false) {
    if (!this.round) return;

    console.log(
      new Date(),
      `Round ended in ${this.name}${canceled ? " (canceled)" : ""}`,
    );

    // Sync sheepCount from ECS entities back to GameClient objects
    if (!canceled) {
      appContext.with(this.round.ecs, () => {
        for (const client of this.clients.values()) {
          const ecsPlayer = getPlayer(client.id);
          if (ecsPlayer?.sheepCount !== undefined) {
            client.sheepCount = ecsPlayer.sheepCount;
          }
        }
      });
    }

    const round = createRoundSummary();

    this.send({
      type: "stop",
      updates: Array.from(this.clients.values()),
      round,
    });
    this.cleanup(round, canceled);
  }

  /** Clean up lobby resources */
  cleanup(
    round?: ReturnType<typeof createRoundSummary>,
    canceled = false,
  ) {
    if (this.tokenExpirationTimer) {
      clearTimeout(this.tokenExpirationTimer);
      this.tokenExpirationTimer = undefined;
    }
    this.round?.clearInterval();
    delete this.round;

    // Notify primary server
    this.onEnd?.(round, canceled);
  }
}
