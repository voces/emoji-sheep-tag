import { send } from "../messaging.ts";
import { terrain } from "../graphics/three.ts";
import { pathingMap } from "../systems/pathing.ts";
import { updatePathingForCliff } from "@/shared/pathing/updatePathingForCliff.ts";
import { getCliffs, getTiles } from "@/shared/map.ts";
import { id as generateId } from "@/shared/util/id.ts";

// Command interface - all editor commands must implement execute and undo
export type EditorCommand =
  | CreateEntityCommand
  | DeleteEntityCommand
  | MoveEntitiesCommand
  | SetPathingCommand
  | SetCliffCommand
  | KeyboardMoveCommand
  | BatchCommand;

export type BatchCommand = {
  type: "batch";
  commands: EditorCommand[];
};

export type CreateEntityCommand = {
  type: "createEntity";
  entityId: string;
  entity: Record<string, unknown>;
};

export type DeleteEntityCommand = {
  type: "deleteEntity";
  entityId: string;
  entity: Record<string, unknown>; // Full entity data for restoration
};

export type MoveEntitiesCommand = {
  type: "moveEntities";
  moves: Array<{
    entityId: string;
    fromX: number;
    fromY: number;
    toX: number;
    toY: number;
  }>;
};

export type SetPathingCommand = {
  type: "setPathing";
  x: number;
  y: number;
  oldPathing: number;
  newPathing: number;
  oldTile: number;
  newTile: number;
};

export type SetCliffCommand = {
  type: "setCliff";
  x: number;
  y: number;
  oldCliff: number | "r";
  newCliff: number | "r";
};

export type KeyboardMoveCommand = {
  type: "keyboardMove";
  entityId: string;
  direction: "up" | "down" | "left" | "right";
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
};

// Undo/redo stacks
const undoStack: EditorCommand[] = [];
const redoStack: EditorCommand[] = [];
const MAX_UNDO_HISTORY = 100;

// Subscribers for UI updates
type Listener = () => void;
const listeners: Listener[] = [];

export const subscribeToCommandHistory = (listener: Listener) => {
  listeners.push(listener);
  return () => {
    const idx = listeners.indexOf(listener);
    if (idx >= 0) listeners.splice(idx, 1);
  };
};

const notifyListeners = () => listeners.forEach((l) => l());

export const canUndo = () => undoStack.length > 0;
export const canRedo = () => redoStack.length > 0;
export const getUndoCount = () => undoStack.length;
export const getRedoCount = () => redoStack.length;

// Helper to update client-side pathing for a cliff change
const updateClientPathingForCliff = (x: number, y: number) => {
  const tiles = getTiles();
  const cliffs = getCliffs();
  updatePathingForCliff(pathingMap, tiles, cliffs, x, tiles.length - 1 - y);
};

// Execute a command and push it to undo stack
export const executeCommand = (command: EditorCommand) => {
  doExecute(command);
  undoStack.push(command);
  if (undoStack.length > MAX_UNDO_HISTORY) undoStack.shift();
  redoStack.length = 0; // Clear redo stack on new command
  notifyListeners();
};

// Actually perform the command (no stack manipulation)
const doExecute = (command: EditorCommand) => {
  switch (command.type) {
    case "createEntity":
      send({
        type: "editorCreateEntity",
        entity: command.entity,
      });
      break;

    case "deleteEntity":
      send({
        type: "unitOrder",
        units: [command.entityId],
        order: "editorRemoveEntity",
      });
      break;

    case "moveEntities":
      send({
        type: "editorUpdateEntities",
        entities: command.moves.map((m) => ({
          id: m.entityId,
          position: { x: m.toX, y: m.toY },
        })),
      });
      break;

    case "setPathing": {
      terrain.setGroundTile(command.x, command.y, command.newTile);
      pathingMap.setPathing(command.x, command.y, command.newPathing);
      send({
        type: "editorSetPathing",
        x: command.x,
        y: command.y,
        pathing: command.newPathing,
        tile: command.newTile,
      });
      break;
    }

    case "setCliff":
      terrain.setCliff(command.x, command.y, command.newCliff);
      updateClientPathingForCliff(command.x, command.y);
      send({
        type: "editorSetCliff",
        x: command.x,
        y: command.y,
        cliff: command.newCliff,
      });
      break;

    case "keyboardMove":
      send({
        type: "editorUpdateEntities",
        entities: [{
          id: command.entityId,
          position: { x: command.toX, y: command.toY },
        }],
      });
      break;

    case "batch":
      for (const cmd of command.commands) {
        doExecute(cmd);
      }
      break;
  }
};

// Undo a command
const doUndo = (command: EditorCommand) => {
  switch (command.type) {
    case "createEntity":
      // Delete the created entity
      send({
        type: "unitOrder",
        units: [command.entityId],
        order: "editorRemoveEntity",
      });
      break;

    case "deleteEntity":
      // Recreate the deleted entity
      send({
        type: "editorCreateEntity",
        entity: { ...command.entity, id: command.entityId },
      });
      break;

    case "moveEntities":
      // Move entities back to original positions
      send({
        type: "editorUpdateEntities",
        entities: command.moves.map((m) => ({
          id: m.entityId,
          position: { x: m.fromX, y: m.fromY },
        })),
      });
      break;

    case "setPathing": {
      terrain.setGroundTile(command.x, command.y, command.oldTile);
      pathingMap.setPathing(command.x, command.y, command.oldPathing);
      send({
        type: "editorSetPathing",
        x: command.x,
        y: command.y,
        pathing: command.oldPathing,
        tile: command.oldTile,
      });
      break;
    }

    case "setCliff":
      terrain.setCliff(command.x, command.y, command.oldCliff);
      updateClientPathingForCliff(command.x, command.y);
      send({
        type: "editorSetCliff",
        x: command.x,
        y: command.y,
        cliff: command.oldCliff,
      });
      break;

    case "keyboardMove":
      send({
        type: "editorUpdateEntities",
        entities: [{
          id: command.entityId,
          position: { x: command.fromX, y: command.fromY },
        }],
      });
      break;

    case "batch":
      // Undo in reverse order
      for (let i = command.commands.length - 1; i >= 0; i--) {
        doUndo(command.commands[i]);
      }
      break;
  }
};

export const undo = () => {
  const command = undoStack.pop();
  if (!command) return;
  doUndo(command);
  redoStack.push(command);
  notifyListeners();
};

export const redo = () => {
  const command = redoStack.pop();
  if (!command) return;
  doExecute(command);
  undoStack.push(command);
  notifyListeners();
};

// Clear history (e.g., when switching maps or leaving editor)
export const clearCommandHistory = () => {
  undoStack.length = 0;
  redoStack.length = 0;
  notifyListeners();
};

// Helper functions to create commands with proper data

export const createEntityCommand = (
  entity: Record<string, unknown>,
  prefab?: string,
): CreateEntityCommand => {
  const entityId = generateId(prefab);
  return {
    type: "createEntity",
    entityId,
    entity: { ...entity, id: entityId },
  };
};

export const moveEntitiesCommand = (
  moves: Array<{
    entityId: string;
    fromX: number;
    fromY: number;
    toX: number;
    toY: number;
  }>,
): MoveEntitiesCommand => ({
  type: "moveEntities",
  moves,
});

export const setPathingCommand = (
  x: number,
  y: number,
  oldPathing: number,
  newPathing: number,
  oldTile: number,
  newTile: number,
): SetPathingCommand => ({
  type: "setPathing",
  x,
  y,
  oldPathing,
  newPathing,
  oldTile,
  newTile,
});

export const setCliffCommand = (
  x: number,
  y: number,
  oldCliff: number | "r",
  newCliff: number | "r",
): SetCliffCommand => ({
  type: "setCliff",
  x,
  y,
  oldCliff,
  newCliff,
});

export const deleteEntityCommand = (
  entityId: string,
  entity: Record<string, unknown>,
): DeleteEntityCommand => ({
  type: "deleteEntity",
  entityId,
  entity,
});

export const keyboardMoveCommand = (
  entityId: string,
  direction: "up" | "down" | "left" | "right",
  fromX: number,
  fromY: number,
): KeyboardMoveCommand => {
  const delta = 0.5;
  const toX = direction === "left"
    ? fromX - delta
    : direction === "right"
    ? fromX + delta
    : fromX;
  const toY = direction === "down"
    ? fromY - delta
    : direction === "up"
    ? fromY + delta
    : fromY;
  return {
    type: "keyboardMove",
    entityId,
    direction,
    fromX,
    fromY,
    toX,
    toY,
  };
};

export const batchCommand = (commands: EditorCommand[]): BatchCommand => ({
  type: "batch",
  commands,
});
