import { makeVar } from "@/hooks/useVar.tsx";

export const chatLogVar = makeVar<
  { id: string; timestamp: number; message: string }[]
>([]);
export const addChatMessage = (message: string) => {
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
    }],
  );
};

export const chatValueVar = makeVar<string>("");
