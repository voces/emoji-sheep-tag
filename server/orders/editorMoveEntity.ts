import { OrderOverride } from "./types.ts";
import { lobbyContext } from "../contexts.ts";

const editorMoveEntity = (dx: number, dy: number) => ({
  canExecute: () => lobbyContext.current.round?.editor ?? false,

  onIssue: (unit) => {
    if (unit.position) {
      unit.position = { x: unit.position.x + dx, y: unit.position.y + dy };
    }
    return "immediate";
  },
} satisfies OrderOverride);

export const editorMoveEntityDown = editorMoveEntity(0, -0.5);
export const editorMoveEntityUp = editorMoveEntity(0, 0.5);
export const editorMoveEntityLeft = editorMoveEntity(-0.5, 0);
export const editorMoveEntityRight = editorMoveEntity(0.5, 0);
