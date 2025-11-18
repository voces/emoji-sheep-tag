import { assertEquals } from "@std/assert";
import { editorMapModifiedVar, editorVar } from "@/vars/editor.ts";
import {
  confirmEditorExit,
  resetEditorModifiedState,
} from "./editorExitConfirmation.ts";

Deno.test("confirmEditorExit returns true when editor is not open", () => {
  editorVar(false);
  editorMapModifiedVar(false);
  assertEquals(confirmEditorExit(), true);
});

Deno.test("confirmEditorExit returns true when editor is open but no changes", () => {
  editorVar(true);
  editorMapModifiedVar(false);
  assertEquals(confirmEditorExit(), true);
});

Deno.test("resetEditorModifiedState resets the modified flag", () => {
  editorMapModifiedVar(true);
  resetEditorModifiedState();
  assertEquals(editorMapModifiedVar(), false);
});
