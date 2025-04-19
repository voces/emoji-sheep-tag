import { Lobby } from "../lobby.ts";

export const computeDesiredFormat = (lobby: Lobby) => {
  const sheep = Math.max(
    Math.floor((lobby.players.size) / 2),
    1,
  );

  return { sheep, wolves: lobby.players.size - sheep };
};
