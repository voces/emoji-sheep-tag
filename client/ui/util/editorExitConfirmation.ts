import { editorMapModifiedVar, editorVar } from "@/vars/editor.ts";

/**
 * Checks if the editor has unsaved changes and prompts the user for confirmation.
 * @returns true if it's safe to exit (no changes or user confirmed), false otherwise
 */
export const confirmEditorExit = (): boolean => {
  if (!editorVar()) return true;
  if (!editorMapModifiedVar()) return true;

  return confirm(
    "You have unsaved changes to your map. Are you sure you want to exit without saving?",
  );
};

/**
 * Resets the editor state when loading a new map
 */
export const resetEditorModifiedState = () => {
  editorMapModifiedVar(false);
};
