import { OrderOverride } from "./types.ts";
import { removeEntity } from "@/shared/api/entity.ts";
import { lobbyContext } from "../contexts.ts";

export const editorRemoveEntity = {
  canExecute: () => lobbyContext.current.round?.editor ?? false,

  onIssue: (unit) => {
    removeEntity(unit);
    return "immediate";
  },
} satisfies OrderOverride;
