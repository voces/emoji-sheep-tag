import { editorMapModifiedVar, editorVar } from "@/vars/editor.ts";
import {
  confirmEditorExit,
  resetEditorModifiedState,
} from "./editorExitConfirmation.ts";
import { assert, test } from "vitest";

test("confirmEditorExit returns true when editor is not open", () => {
  editorVar(false);
  editorMapModifiedVar(false);
  assert.deepEqual(confirmEditorExit(), true);
});

test("confirmEditorExit returns true when editor is open but no changes", () => {
  editorVar(true);
  editorMapModifiedVar(false);
  assert.deepEqual(confirmEditorExit(), true);
});

test("resetEditorModifiedState resets the modified flag", () => {
  editorMapModifiedVar(true);
  resetEditorModifiedState();
  assert.deepEqual(editorMapModifiedVar(), false);
});
