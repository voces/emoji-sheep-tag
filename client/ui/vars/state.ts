import { makeVar } from "../hooks/useVar.tsx";

export const stateVar = makeVar<"intro" | "lobby" | "playing">("lobby");
