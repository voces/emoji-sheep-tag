import { makeVar } from "@/hooks/useVar.tsx";

export const showCommandPaletteVar = makeVar<
  "closed" | "open" | "sent" | "dismissed"
>("closed");
