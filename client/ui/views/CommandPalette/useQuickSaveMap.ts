import { useMemo } from "react";
import { useReactiveVar } from "@/hooks/useVar.tsx";
import { editorCurrentMapVar, editorMapModifiedVar } from "@/vars/editor.ts";
import { buildPackedMapFromEditor } from "../../../util/mapExport.ts";
import { saveLocalMap } from "../../../storage/localMaps.ts";
import {
  formatValidationError,
  validatePackedMap,
} from "@/shared/map/validation.ts";
import { addChatMessage } from "@/vars/chat.ts";
import { triggerLocalMapsRefresh } from "@/vars/localMapsRefresh.ts";

export const useQuickSaveMap = () => {
  const currentMap = useReactiveVar(editorCurrentMapVar);

  return useMemo(() => ({
    name: "Save map",
    description: currentMap
      ? `Save changes to "${currentMap.name}"`
      : "Save the current map",
    valid: () => !!currentMap,
    callback: async () => {
      if (!currentMap) return;

      const packed = buildPackedMapFromEditor();
      const validation = validatePackedMap(packed);

      if (!validation.valid) {
        const errorMessages = validation.errors.map(formatValidationError).join(
          ", ",
        );
        addChatMessage(`Map validation failed: ${errorMessages}`);
        return;
      }

      try {
        await saveLocalMap(currentMap.id, currentMap.name, packed);
        addChatMessage(`Map "${currentMap.name}" saved successfully!`);
        editorMapModifiedVar(false);
        triggerLocalMapsRefresh();
      } catch (err) {
        addChatMessage(
          `Failed to save map: ${
            err instanceof Error ? err.message : "Unknown error"
          }`,
        );
      }
    },
  }), [currentMap]);
};
