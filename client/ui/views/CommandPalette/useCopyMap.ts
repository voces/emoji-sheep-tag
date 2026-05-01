import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useReactiveVar } from "@/hooks/useVar.tsx";
import { editorCurrentMapVar, editorVar } from "@/vars/editor.ts";
import { buildPackedMapFromEditor } from "../../../util/mapExport.ts";
import { validatePackedMap } from "@/shared/map/validation.ts";
import { translateValidationError } from "@/util/mapValidationMessages.ts";
import { addChatMessage } from "@/vars/chat.ts";

const copyPacked = async (
  mapData: ReturnType<typeof buildPackedMapFromEditor>,
) => {
  const validation = validatePackedMap(mapData);
  if (!validation.valid) {
    const errorMessages = validation.errors.map(translateValidationError)
      .join(", ");
    addChatMessage(`Map validation failed: ${errorMessages}`);
    return;
  }
  try {
    const jsonString = JSON.stringify(mapData, null, 2);
    await navigator.clipboard.writeText(jsonString);
  } catch (err) {
    alert(
      `Failed to copy map to clipboard: ${
        err instanceof Error ? err.message : "Unknown error"
      }`,
    );
  }
};

export const useCopyMap = () => {
  const { t } = useTranslation();
  const currentMap = useReactiveVar(editorCurrentMapVar);
  const isUnnamed = !currentMap;
  return useMemo(() => ({
    name: t("commands.copyMap"),
    description: t("commands.copyMapDesc"),
    valid: editorVar,
    callback: () => {
      const mapData = buildPackedMapFromEditor();
      if (mapData.name && mapData.name.trim()) {
        copyPacked(mapData);
        return;
      }
      return {
        type: "prompt" as const,
        placeholder: t("commands.saveMapAsNamePrompt"),
        callback: (name: string) => {
          const trimmed = name.trim();
          if (!trimmed) {
            addChatMessage("Map name cannot be empty");
            return;
          }
          const { name: _, ...rest } = mapData;
          copyPacked({ name: trimmed, ...rest });
        },
      };
    },
  }), [t, isUnnamed]);
};
