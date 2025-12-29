import type { z } from "zod";
import type { zServerToShardMessage } from "@/shared/shard.ts";
import type { GameClient } from "./gameClient.ts";
import type { CaptainsDraft, Round } from "../lobby.ts";
import { buildLoadedMap, type PackedMap } from "@/shared/map.ts";
import { getMapMeta } from "@/shared/maps/manifest.ts";
import { initializeGame } from "../st/gameStartHelpers.ts";
import { addEntity } from "@/shared/api/entity.ts";
import { appContext } from "@/shared/context.ts";
import { lobbyContext } from "../contexts.ts";
import { createRoundSummary, send } from "../lobbyApi.ts";
import { addPlayerToPracticeGame, removePlayerFromEcs } from "../api/player.ts";
import { flushUpdates } from "../updates.ts";
import { serializeLobbySettings } from "../actions/lobbySettings.ts";
import { serializeCaptainsDraft } from "../actions/captains.ts";

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
  private notifiedPrimary = false;

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
    practice?: boolean,
    sheepWon?: boolean,
    startLocations?: Record<string, { x: number; y: number; map: string }>,
  ) => void;
  onStartLocationUpdate?: (
    playerId: string,
    startLocation: { x: number; y: number; map: string },
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

  /** Add a new expected player (mid-game join) */
  addExpectedPlayer(player: PlayerInfo) {
    this.expectedPlayers.set(player.token, player);
  }

  /** Add an authenticated client */
  addClient(client: GameClient) {
    // If game is already running, this is a mid-game join
    // Handle before adding to clients so broadcast goes to existing clients only
    if (this.round) {
      this.addPlayerToRunningGame(client);
      this.clients.set(client.id, client);
      return;
    }

    this.clients.set(client.id, client);

    // Check if all expected players have connected and start
    if (this.expectedPlayers.size === 0) this.startGame();
  }

  /** Add a player to an already running game */
  private addPlayerToRunningGame(client: GameClient) {
    const isPractice = this.round!.practice;

    lobbyContext.with(this, () => {
      appContext.with(this.round!.ecs, () => {
        this.round!.ecs.batch(() => {
          if (isPractice) addPlayerToPracticeGame(client);
          // Non-practice: add as observer/pending
          else {
            addEntity({
              id: client.id,
              name: client.name,
              playerColor: client.playerColor,
              isPlayer: true,
              team: client.team,
              gold: 0,
              handicap: client.handicap,
            });
          }
        });

        // Broadcast the new player/units to existing clients
        send({
          type: "join",
          lobby: this.name,
          status: this.status,
          updates: flushUpdates(false),
          lobbySettings: serializeLobbySettings(this),
          captainsDraft: serializeCaptainsDraft(this.captainsDraft),
        });

        // Send full game state to the joining client
        // Sort so players come first (ensures owners exist before their units)
        const entities = Array.from(this.round!.ecs.entities).sort((a, b) =>
          (b.isPlayer ? 1 : 0) - (a.isPlayer ? 1 : 0)
        );
        client.send({
          type: "join",
          lobby: this.name,
          status: this.status,
          updates: entities,
          rounds: this.rounds,
          lobbySettings: serializeLobbySettings(this),
          localPlayer: client.id,
          captainsDraft: serializeCaptainsDraft(this.captainsDraft),
        });
      });
    });
  }

  /** Remove a disconnected client */
  removeClient(client: GameClient) {
    console.log(new Date(), `Client ${client.id} left ${this.name}`);

    // Clean up player entities from ECS
    if (this.round?.ecs) {
      lobbyContext.with(this, () => {
        appContext.with(this.round!.ecs, () => {
          this.round!.ecs.batch(() => removePlayerFromEcs(client.id));

          // Send leave event to remaining clients
          send({
            type: "leave",
            updates: flushUpdates(false),
            lobbySettings: serializeLobbySettings(this),
          });
        });
      });

      // End round if team now empty (but not in practice mode)
      if (client.team && !this.practice) {
        const sheep = Array.from(this.clients.values()).filter((p) =>
          p.team === "sheep" && p !== client
        );
        const wolves = Array.from(this.clients.values()).filter((p) =>
          p.team === "wolf" && p !== client
        );
        if (sheep.length === 0 || wolves.length === 0) {
          this.endRound(
            !this.round.start || Date.now() - this.round.start < 10_000,
          );
        }
      }
    }

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
        onSheepWin: () => this.endRound(false, true),
      }));
  }

  /** End the current round */
  endRound(canceled = false, sheepWon = false, notifyPrimary = true) {
    if (!this.round) return;

    console.log(
      new Date(),
      `Round ended in ${this.name}${canceled ? " (canceled)" : ""}`,
    );

    lobbyContext.with(this, () => {
      const round = createRoundSummary();
      // Collect start locations from all clients
      const startLocations: Record<
        string,
        { x: number; y: number; map: string }
      > = {};
      for (const client of this.clients.values()) {
        if (client.startLocation) {
          startLocations[client.id] = client.startLocation;
        }
      }
      this.cleanup(round, canceled, sheepWon, notifyPrimary, startLocations);
    });
  }

  /** Clean up lobby resources */
  cleanup(
    round?: ReturnType<typeof createRoundSummary>,
    canceled = false,
    sheepWon = false,
    notifyPrimary = true,
    startLocations?: Record<string, { x: number; y: number; map: string }>,
  ) {
    if (this.tokenExpirationTimer) {
      clearTimeout(this.tokenExpirationTimer);
      this.tokenExpirationTimer = undefined;
    }
    this.round?.clearInterval();
    delete this.round;

    // Notify primary server (skip if already notified or primary requested the cancel)
    if (!this.notifiedPrimary) {
      this.notifiedPrimary = true;
      if (notifyPrimary) {
        this.onEnd?.(round, canceled, this.practice, sheepWon, startLocations);
      }
    }
  }
}
