import { connect } from "../../client.ts";
import { loadLocal } from "../../local.ts";
import { editorCurrentMapVar, editorVar } from "@/vars/editor.ts";
import { switchToEditorMode } from "@/shared/systems/kd.ts";
import { resetEditorModifiedState } from "./editorExitConfirmation.ts";
import { lobbySettingsVar } from "@/vars/lobbySettings.ts";
import { MAPS } from "@/shared/maps/manifest.ts";

export const openEditor = () => {
  editorVar(true);
  switchToEditorMode();
  loadLocal();
  connect();
  resetEditorModifiedState();
  const defaultMapId = lobbySettingsVar().map;
  const defaultMap = MAPS.find((m) => m.id === defaultMapId);
  editorCurrentMapVar(
    defaultMap ? { id: defaultMap.id, name: defaultMap.name } : undefined,
  );
};
