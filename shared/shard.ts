import { z } from "zod";

// Messages from Shard to Primary Server
export const zShardToServerMessage = z.discriminatedUnion("type", [
  // Shard registers itself with the primary server
  z.object({
    type: z.literal("register"),
    name: z.string().optional(), // Display name - derived from hostname/IP if not provided
    port: z.number(), // Port the shard is listening on
    // Optional URL override - if not provided, primary derives from shard's IP + port
    publicUrl: z.string().optional(),
  }),
  // Shard reports its current status
  z.object({
    type: z.literal("status"),
    lobbies: z.number(), // Current active lobby count
    players: z.number(), // Current connected player count
  }),
  // Shard reports a lobby has ended
  z.object({
    type: z.literal("lobbyEnded"),
    lobbyId: z.string(),
    canceled: z.boolean().optional(), // True if host canceled the round
    practice: z.boolean().optional(), // True if practice mode
    round: z.object({
      sheep: z.array(z.string()),
      wolves: z.array(z.string()),
      duration: z.number(),
    }).optional(),
  }),
  // Shard notifies primary that a player's team changed (e.g., mid-game practice join)
  z.object({
    type: z.literal("playerTeamChanged"),
    lobbyId: z.string(),
    playerId: z.string(),
    team: z.union([
      z.literal("pending"),
      z.literal("observer"),
      z.literal("sheep"),
      z.literal("wolf"),
    ]),
  }),
]);

export type ShardToServerMessage = z.infer<typeof zShardToServerMessage>;

// Messages from Primary Server to Shard
export const zServerToShardMessage = z.discriminatedUnion("type", [
  // Server acknowledges registration
  z.object({
    type: z.literal("registered"),
    shardId: z.string(),
  }),
  // Server rejects registration (bad secret, etc.)
  z.object({
    type: z.literal("rejected"),
    reason: z.string(),
  }),
  // Server assigns a lobby to this shard
  z.object({
    type: z.literal("assignLobby"),
    lobbyId: z.string(),
    settings: z.object({
      map: z.string(),
      mode: z.union([
        z.literal("survival"),
        z.literal("vip"),
        z.literal("switch"),
        z.literal("vamp"),
      ]),
      vipHandicap: z.number(),
      sheep: z.union([z.literal("auto"), z.number()]),
      time: z.union([z.literal("auto"), z.number()]),
      startingGold: z.object({ sheep: z.number(), wolves: z.number() }),
      income: z.object({ sheep: z.number(), wolves: z.number() }),
      view: z.boolean(),
      teamGold: z.boolean(),
    }),
    // Players who will connect, with their initial state
    players: z.array(z.object({
      id: z.string(),
      name: z.string(),
      playerColor: z.string(),
      team: z.union([
        z.literal("pending"),
        z.literal("observer"),
        z.literal("sheep"),
        z.literal("wolf"),
      ]),
      sheepCount: z.number(),
      token: z.string(), // One-time token for player auth
    })),
    hostId: z.string().nullable(),
    practice: z.boolean(),
    editor: z.boolean(),
    customMapData: z.unknown().optional(), // For local: maps
  }),
  // Server adds a player to an in-progress game (mid-game join)
  z.object({
    type: z.literal("addPlayer"),
    lobbyId: z.string(),
    player: z.object({
      id: z.string(),
      name: z.string(),
      playerColor: z.string(),
      team: z.union([
        z.literal("pending"),
        z.literal("observer"),
        z.literal("sheep"),
        z.literal("wolf"),
      ]),
      sheepCount: z.number(),
      token: z.string(),
    }),
  }),
]);

export type ServerToShardMessage = z.infer<typeof zServerToShardMessage>;

// Info about a shard, as seen by clients
export const zShardInfo = z.object({
  id: z.string(),
  name: z.string(),
  region: z.string().optional(),
  playerCount: z.number(),
  lobbyCount: z.number(),
  isOnline: z.boolean(),
  // For Fly.io regions that can be launched on-demand
  flyRegion: z.string().optional(), // e.g., "lax", "ewr"
  status: z.enum(["online", "launching", "offline"]).optional(), // undefined = use isOnline
});

export type ShardInfo = z.infer<typeof zShardInfo>;
