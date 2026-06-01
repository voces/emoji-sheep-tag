import { OrderOverride } from "./types.ts";
import { lobbyContext } from "../contexts.ts";

export const editorMoveEntityDown = {
  canExecute: () => lobbyContext.current.round?.editor ?? false,

  onIssue: (unit) => {
    if (unit.position) {
      unit.position = { x: unit.position.x, y: unit.position.y - 0.5 };
    }
    return "immediate";
  },
} satisfies OrderOverride;

export const editorMoveEntityUp = {
  canExecute: () => lobbyContext.current.round?.editor ?? false,

  onIssue: (unit) => {
    if (unit.position) {
      unit.position = { x: unit.position.x, y: unit.position.y + 0.5 };
    }
    return "immediate";
  },
} satisfies OrderOverride;

export const editorMoveEntityLeft = {
  canExecute: () => lobbyContext.current.round?.editor ?? false,

  onIssue: (unit) => {
    if (unit.position) {
      unit.position = { x: unit.position.x - 0.5, y: unit.position.y };
    }
    return "immediate";
  },
} satisfies OrderOverride;

export const editorMoveEntityRight = {
  canExecute: () => lobbyContext.current.round?.editor ?? false,

  onIssue: (unit) => {
    if (unit.position) {
      unit.position = { x: unit.position.x + 0.5, y: unit.position.y };
    }
    return "immediate";
  },
} satisfies OrderOverride;
