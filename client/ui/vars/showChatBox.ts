import { makeVar } from "@/hooks/useVar.tsx";

export const showChatBoxVar = makeVar<"closed" | "open" | "sent" | "dismissed">(
  "closed",
);
