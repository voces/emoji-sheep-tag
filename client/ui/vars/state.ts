import { makeVar } from "@/hooks/useVar.tsx";

export const stateVar = makeVar<"menu" | "hub" | "lobby" | "playing">(
  "menu",
);

export const connectionStatusVar = makeVar<
  "notConnected" | "connected" | "disconnected"
>("notConnected");
