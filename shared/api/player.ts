import { getTeams } from "../systems/teams.ts";

export const getPlayerTeam = (player: string) => {
  const teams = getTeams();
  if (teams.sheep.some((p) => p.owner === player)) return "sheep";
  if (teams.wolves.some((p) => p.owner === player)) return "wolf";
  return "neutral";
};
