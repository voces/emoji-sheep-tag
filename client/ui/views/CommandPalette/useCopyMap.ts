import { useMemo } from "react";
import { editorVar } from "@/vars/editor.ts";
import { buildPackedMapFromEditor } from "../../../util/mapExport.ts";

export const useCopyMap = () =>
  useMemo(() => ({
    name: "Copy map",
    description: "Copy map JSON to clipboard",
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
  }), []);
