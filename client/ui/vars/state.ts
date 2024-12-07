import { makeVar } from "../hooks/useVar.tsx";
import { Player } from "./players.ts";

export const stateVar = makeVar<"menu" | "lobby" | "playing">(
  "menu",
);

export const connectionStatusVar = makeVar<
  "notConnected" | "connected" | "disconnected"
>("notConnected");
