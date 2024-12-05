import { makeVar } from "../hooks/useVar.tsx";

export const stateVar = makeVar<"intro" | "menu" | "lobby" | "playing">(
  "intro",
);
