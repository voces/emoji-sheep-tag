import { Entity } from "@/shared/types.ts";
import { OrderDefinition } from "./types.ts";
import { removeEntity } from "@/shared/api/entity.ts";
import { lobbyContext } from "../contexts.ts";

export const editorRemoveEntity = {
  id: "editorRemoveEntity",

  canExecute: () => {
    console.log("canExecute?");
    return lobbyContext.current.round?.editor ?? false;
  },

  onIssue: (unit: Entity) => {
    removeEntity(unit);
    return "immediate";
  },
} satisfies OrderDefinition;
