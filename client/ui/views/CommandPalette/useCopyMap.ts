import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { editorVar } from "@/vars/editor.ts";
import { buildPackedMapFromEditor } from "../../../util/mapExport.ts";

export const useCopyMap = () => {
  const { t } = useTranslation();
  return useMemo(() => ({
    name: t("commands.copyMap"),
    description: t("commands.copyMapDesc"),
    valid: editorVar,
    callback: async () => {
      try {
        const mapData = buildPackedMapFromEditor();
        const jsonString = JSON.stringify(mapData, null, 2);
        await navigator.clipboard.writeText(jsonString);
      } catch (err) {
        alert(
          `Failed to copy map to clipboard: ${
            err instanceof Error ? err.message : "Unknown error"
          }`,
        );
      }
    },
  }), [t]);
};
