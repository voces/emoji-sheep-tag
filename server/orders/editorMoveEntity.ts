import { OrderDefinition } from "./types.ts";
import { lobbyContext } from "../contexts.ts";

export const editorMoveEntityDown = {
  id: "editorMoveEntityDown",

  canExecute: () => lobbyContext.current.round?.editor ?? false,

  onIssue: (unit) => {
    if (unit.position) {
      unit.position = { x: unit.position.x, y: unit.position.y - 0.5 };
    }
    return "immediate";
  },
} satisfies OrderDefinition;

export const editorMoveEntityUp = {
  id: "editorMoveEntityUp",

  canExecute: () => lobbyContext.current.round?.editor ?? false,

  onIssue: (unit) => {
    if (unit.position) {
      unit.position = { x: unit.position.x, y: unit.position.y + 0.5 };
    }
    return "immediate";
  },
} satisfies OrderDefinition;

export const editorMoveEntityLeft = {
  id: "editorMoveEntityLeft",

  canExecute: () => lobbyContext.current.round?.editor ?? false,

  onIssue: (unit) => {
    if (unit.position) {
      unit.position = { x: unit.position.x - 0.5, y: unit.position.y };
    }
    return "immediate";
  },
} satisfies OrderDefinition;

export const editorMoveEntityRight = {
  id: "editorMoveEntityRight",

  canExecute: () => lobbyContext.current.round?.editor ?? false,

  onIssue: (unit) => {
    if (unit.position) {
      unit.position = { x: unit.position.x + 0.5, y: unit.position.y };
    }
    return "immediate";
  },
} satisfies OrderDefinition;
