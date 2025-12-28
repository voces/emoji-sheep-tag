import { makeVar } from "@/hooks/useVar.tsx";
import { colorName, playerEntities } from "@/shared/api/player.ts";
import { localPlayerIdVar } from "./localPlayerId.ts";
import { onInit } from "@/shared/context.ts";

export type ChatChannel = "all" | "allies";

export const chatChannelVar = makeVar<ChatChannel>("all");

export const toggleChatChannel = () => {
  chatChannelVar((current) => current === "all" ? "allies" : "all");
};

export const chatLogVar = makeVar<
  { id: string; timestamp: number; message: string; channel?: ChatChannel }[]
>([]);
export const addChatMessage = (message: string, channel?: ChatChannel) => {
  // Not sure why I can't use playSound directly, but esbuild gets mad about the import
  globalThis.dispatchEvent(
    new CustomEvent("sound", {
      detail: { path: "thud2", volume: 0.1, channel: "ui" },
    }),
  );
  chatLogVar(
    (log) => [...(log.length > 100 ? log.slice(-99) : log), {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      message,
      channel,
    }],
  );
};

export const chatValueVar = makeVar<string>("");

onInit(() =>
  playerEntities().addEventListener("delete", (p) => {
    if (p.id === localPlayerIdVar() || p.id === "practice-enemy") return;
    addChatMessage(`${colorName(p)} has left the game!`);
  })
);
