import { Team } from "../shared/zod.ts";
import { type Client } from "./client.ts";
import { Entity } from "../shared/types.ts";
import { Game } from "./ecs.ts";

/**
 * Contexts:
 *  - lobby: stores references to users, settings, and the current round if one is active
 *  - event: stores references to event-data (who, what, etc)
 */

// type Player = {
//   id: string;
//   name: string;
//   color: string;
// };

type LobbySettings = {
  teams: Map<Client, Team>;
  // /**
  //  * - `"survival"`: classic ST
  //  * - `"bulldog"`: sheep must reach the end
  //  * - `"team_bulldog"`: all sheep must reach the end
  //  */
  // mode: "survival";
  // /**
  //  * Uses a smart algorithm to rotate sheep and wolves
  //  */
  // teamSelection: "smart";
  // /**
  //  * - A `number` will draft the specified number of sheep
  //  * - `"auto"` will draft (N/2)-1 sheep, where N is the number of players
  //  */
  // sheep: "auto" | number;
  // /**
  //  * - A number indicates the max number of seconds of each round
  //  * - `"auto"` factors in sheep and wolves to determine an appropiate time
  //  */
  // time: "auto" | number;
  // gold: [number, number];
  // income: [number, number];
  // view: boolean;
};

type LobbyStatus = "lobby" | "playing";

type Round = {
  ecs: Game;
  lookup: Record<string, Entity | undefined>;
  sheep: Set<Client>;
  wolves: Set<Client>;
  start: number;
  clearInterval: () => void;
};

export type Lobby = {
  players: Set<Client>;
  host: Client | undefined; // Auto (ranked) lobbies have no host
  name: string | undefined; // Auto (ranked) lobbies have no name
  settings: LobbySettings;
  status: LobbyStatus;
  round?: Round;
  rounds: { sheep: string[]; wolves: string[]; duration: number }[];
};

// type GEvent = {};

export const lobbies = new Set<Lobby>();
Object.assign(globalThis, { lobbies });
// const eventContext = new ContextManager<GEvent>();

export const deleteLobby = (lobby: Lobby) => {
  lobbies.delete(lobby);
  lobby.round?.clearInterval();
  delete lobby.round;
  console.log(new Date(), "Lobby deleted", lobby.name);
};

let lobbyIndex = 0;
export const newLobby = (host?: Client) => {
  const lobby: Lobby = {
    players: new Set(host ? [host] : []),
    host: host,
    name: `lobby-${lobbyIndex++}`,
    settings: { teams: new Map() },
    status: "lobby",
    rounds: [],
  };
  console.log(new Date(), "Lobby", lobby.name, "created with host", host?.id);
  lobbies.add(lobby);
  return lobby;
};
