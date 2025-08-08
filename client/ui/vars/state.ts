import { makeVar } from "@/hooks/useVar.tsx";

export const stateVar = makeVar<"menu" | "lobby" | "playing">(
  "menu",
);

export const connectionStatusVar = makeVar<
  "notConnected" | "connected" | "disconnected"
>("notConnected");
