import { colors } from "@/shared/data.ts";
import type { Lobby } from "./lobby.ts";

export const pickFreeColor = (lobby: Lobby) =>
  colors.find((c) => !lobby.players.values().some((p) => p.playerColor === c));
