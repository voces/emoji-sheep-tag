import { getTeams } from "../systems/teams.ts";

export const getPlayerTeam = (player: string) => {
  const teams = getTeams();
  if (teams.sheep.some((p) => p.owner === player)) return "sheep";
  if (teams.wolves.some((p) => p.owner === player)) return "wolf";
  return "neutral";
};

export const colorName = (
  player: { color: string; name: string } | {
    playerColor?: string | undefined | null;
    name?: string | undefined;
  },
) =>
  `|c${("color" in player ? player.color : player.playerColor) || "#FFFFFF"}|${
    player.name ?? "<unknown>"
  }|`;
