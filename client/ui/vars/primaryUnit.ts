import { makeVar } from "@/hooks/useVar.tsx";
import type { Entity } from "../../ecs.ts";

export const primaryUnitVar = makeVar<Entity | undefined>(undefined);
