import { OrderDefinition } from "./types.ts";
import { removeEntity } from "@/shared/api/entity.ts";
import { lobbyContext } from "../contexts.ts";

export const editorRemoveEntity = {
  id: "editorRemoveEntity",

  canExecute: () => lobbyContext.current.round?.editor ?? false,

  onIssue: (unit) => {
    removeEntity(unit);
    return "immediate";
  },
} satisfies OrderDefinition;
