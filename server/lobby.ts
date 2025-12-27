import { type Client } from "./client.ts";
import { broadcastLobbyList } from "./hub.ts";
import { generateLobbyName } from "./util/lobbyNames.ts";
import { cleanupSmartDrafter } from "./st/roundHelpers.ts";
import type { Game } from "./ecs.ts";

/**
 * Contexts:
 *  - lobby: stores references to users, settings, and the current round if one is active
 *  - event: stores references to event-data (who, what, etc)
 */

type LobbySettings = {
  map: string;
  /**
   * - `"survival"`: classic ST - sheep must survive until time runs out
   * - `"vip"`: one random sheep is VIP, wolves win if VIP dies
   * - `"switch"`: when a sheep dies, attacker becomes sheep, victim becomes wolf
   * - `"vamp"`: when a sheep dies, it becomes a wolf; round ends when all sheep are captured
   * - `"bulldog"`: sheep must reach the end
   * - `"katma"`: all sheep must reach the end
   */
  mode: "survival" | "vip" | "switch" | "vamp";
  /**
   * Health multiplier for sheep structures in VIP mode (0.01-10)
   */
  vipHandicap: number;
  /**
   * - A `number` will draft the specified number of sheep
   * - `"auto"` will draft (N/2)-1 sheep, where N is the number of players
   */
  sheep: "auto" | number;
  /**
   * - A number indicates the max number of seconds of each round
   * - `"auto"` factors in sheep and wolves to determine an appropiate time
   */
  time: "auto" | number;
  startingGold: { sheep: number; wolves: number };
  income: { sheep: number; wolves: number };
  view: boolean;
  /** Pool gold at team level. Only applies to survival mode. */
  teamGold: boolean;
  /** Shard ID to run the game on, or undefined for primary server */
  shard?: string;
  /** If true, shard is auto-selected based on player locations. Set to false when host explicitly chooses. */
  shardAutoSelect?: boolean;
};

type LobbyStatus = "lobby" | "playing";

export type CaptainsDraft = {
  /**
   * - "selecting-captains": host is picking captains
   * - "drafting": captains are picking teams
   * - "drafted": teams are set, waiting for first round
   * - "reversed": first round complete, teams reversed, waiting for second round
   */
  phase: "selecting-captains" | "drafting" | "drafted" | "reversed";
  captains: string[]; // player IDs, 0-2 captains
  picks: [string[], string[]]; // picks[0] = captain 0's team, picks[1] = captain 1's team
  currentPicker: 0 | 1;
  picksThisTurn: number; // for snake draft (1 or 2)
};

export type Round = {
  ecs: Game;
  practice: boolean;
  editor: boolean;
  clearInterval: () => void;
  vip?: string;
  start?: number;
  duration?: number;
};

export type Lobby = {
  players: Set<Client>;
  host: Client | undefined; // Auto (ranked) lobbies have no host
  name: string;
  settings: LobbySettings;
  status: LobbyStatus;
  round?: Round;
  rounds: { sheep: string[]; wolves: string[]; duration: number }[];
  captainsDraft?: CaptainsDraft;
  /** Shard ID where the current game is running (if any). */
  activeShard?: string;
};

// Global lobbies set for the primary server
export const lobbies = new Set<Lobby>();

Object.assign(globalThis, { lobbies });

export const deleteLobby = (lobby: Lobby) => {
  lobbies.delete(lobby);
  lobby.round?.clearInterval();
  delete lobby.round;
  cleanupSmartDrafter(lobby);
  console.log(new Date(), "Lobby deleted", lobby.name);
  broadcastLobbyList();
};

export const newLobby = (host?: Client) => {
  const lobby: Lobby = {
    players: new Set(host ? [host] : []),
    host: host,
    name: generateLobbyName(),
    settings: {
      map: "revo",
      mode: "survival",
      vipHandicap: 0.8,
      sheep: "auto",
      time: "auto",
      startingGold: { sheep: 0, wolves: 0 },
      income: { sheep: 1, wolves: 1 },
      view: false,
      teamGold: true,
      shardAutoSelect: true,
    },
    status: "lobby",
    rounds: [],
  };
  console.log(new Date(), "Lobby", lobby.name, "created with host", host?.id);
  lobbies.add(lobby);

  // Assign host to sheep team (first player should be sheep)
  if (host) {
    host.team = "sheep";
  }

  // Update lobby list for hub
  broadcastLobbyList();

  return lobby;
};
