import { makeVar } from "@/hooks/useVar.tsx";
import type { Entity } from "../../ecs.ts";

export const selectionFocusVar = makeVar<Entity | undefined>(undefined);
