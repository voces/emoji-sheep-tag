import { makeVar } from "@/hooks/useVar.tsx";

export const draftModeVar = makeVar<"manual" | "smart">("smart");
