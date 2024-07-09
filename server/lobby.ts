import { ContextManager } from "./ContextManager.ts";

/**
 * Contexts:
 *  - lobby: stores references to users, settings, and the current round if one is active
 *  - event: stores references to event-data (who, what, etc)
 */

type Player = {
  id: string;
  name: string;
  slot: number;
};

type LobbySettings = {
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

type Lobby = {
  players: Set<Player>;
  host: Player | undefined; // Auto (ranked) lobbies have no host
  name: string | undefined; // Auto (ranked) lobbies have no name
  settings: LobbySettings;
};

// type GEvent = {};

const lobbyContext = new ContextManager<Lobby>();
// const eventContext = new ContextManager<GEvent>();
