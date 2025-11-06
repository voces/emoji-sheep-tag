import { type Client } from "./client.ts";
import { Game } from "./ecs.ts";
import { broadcastLobbyList } from "./hub.ts";
import { generateLobbyName } from "./util/lobbyNames.ts";
import { cleanupSmartDrafter } from "./st/roundHelpers.ts";

/**
 * Contexts:
 *  - lobby: stores references to users, settings, and the current round if one is active
 *  - event: stores references to event-data (who, what, etc)
 */

type LobbySettings = {
  /**
   * - `"survival"`: classic ST - sheep must survive until time runs out
   * - `"vip"`: one random sheep is VIP, wolves win if VIP dies
   * - `"switch"`: when a sheep dies, attacker becomes sheep, victim becomes wolf
   * - `"bulldog"`: sheep must reach the end
   * - `"katma"`: all sheep must reach the end
   */
  mode: "survival" | "vip" | "switch";
  /**
   * Health multiplier for sheep structures in VIP mode (0.01-10)
   */
  vipHandicap: number;
  // /**
  //  * Uses a smart algorithm to rotate sheep and wolves
  //  */
  // teamSelection: "smart";
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
  // view: boolean;
};

type LobbyStatus = "lobby" | "playing";

type Round = {
  ecs: Game;
  start: number;
  clearInterval: () => void;
  practice: boolean;
  editor: boolean;
  vip?: string;
};

export type Lobby = {
  players: Set<Client>;
  host: Client | undefined; // Auto (ranked) lobbies have no host
  name: string;
  settings: LobbySettings;
  status: LobbyStatus;
  round?: Round;
  rounds: { sheep: string[]; wolves: string[]; duration: number }[];
};

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
      mode: "survival",
      vipHandicap: 0.8,
      sheep: "auto",
      time: "auto",
      startingGold: { sheep: 0, wolves: 0 },
      income: { sheep: 1, wolves: 1 },
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
