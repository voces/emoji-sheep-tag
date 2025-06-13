import { Player } from "../ui/vars/players.ts";

export const format = (player: Player) => `|c${player.color}|${player.name}|`;
