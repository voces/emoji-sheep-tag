import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  editorCurrentMapVar,
  editorMapModifiedVar,
  editorVar,
} from "@/vars/editor.ts";
import { buildPackedMapFromEditor } from "../../../util/mapExport.ts";
import {
  exportLocalMapToFile,
  getLocalMapByName,
  saveLocalMap,
} from "../../../storage/localMaps.ts";
import {
  formatValidationError,
  validatePackedMap,
} from "@/shared/map/validation.ts";
import { addChatMessage } from "@/vars/chat.ts";
import { triggerLocalMapsRefresh } from "@/vars/localMapsRefresh.ts";

type SaveResult =
  | { success: true }
  | { success: false; reason: "validation" | "error" }
  | { success: false; reason: "conflict"; existingId: string };

const saveMapWithName = async (name: string): Promise<SaveResult> => {
  const existing = await getLocalMapByName(name);
  if (existing) {
    return { success: false, reason: "conflict", existingId: existing.id };
  }

  const id = `${name.replace(/[^a-z0-9]/gi, "-").toLowerCase()}-${Date.now()}`;
  editorCurrentMapVar({ id, name });

  const packed = buildPackedMapFromEditor();
  const validation = validatePackedMap(packed);

  if (!validation.valid) {
    const errorMessages = validation.errors.map(formatValidationError).join(
      ", ",
    );
    addChatMessage(`Map validation failed: ${errorMessages}`);
    return { success: false, reason: "validation" };
  }

  try {
    await saveLocalMap(id, name, packed);
    addChatMessage(`Map "${name}" saved successfully!`);
    editorMapModifiedVar(false);
    triggerLocalMapsRefresh();
    return { success: true };
  } catch (err) {
    addChatMessage(
      `Failed to save map: ${
        err instanceof Error ? err.message : "Unknown error"
      }`,
    );
    return { success: false, reason: "error" };
  }
};

const overwriteMap = async (id: string, name: string): Promise<boolean> => {
  editorCurrentMapVar({ id, name });

  const packed = buildPackedMapFromEditor();
  try {
    await saveLocalMap(id, name, packed);
    addChatMessage(`Map "${name}" overwritten successfully!`);
    editorMapModifiedVar(false);
    triggerLocalMapsRefresh();
    return true;
  } catch (err) {
    addChatMessage(
      `Failed to overwrite map: ${
        err instanceof Error ? err.message : "Unknown error"
      }`,
    );
    return false;
  }
};

export const useSaveMapAs = () => {
  const { t } = useTranslation();
  return useMemo(() => ({
    name: t("commands.saveMapAs"),
    description: t("commands.saveMapAsDesc"),
    valid: editorVar,
    callback: () => ({
      type: "options" as const,
      placeholder: t("commands.saveMapAs"),
      commands: [
        {
          name: t("commands.saveMapAsToBrowser"),
          description: t("commands.saveMapAsToBrowserDesc"),
          callback: () => {
            const handleSave = async (mapName: string) => {
              const trimmedName = mapName.trim();
              if (!trimmedName) {
                addChatMessage("Map name cannot be empty");
                return;
              }

              const result = await saveMapWithName(trimmedName);

              if (result.success) {
                return;
              }

              if (result.reason === "conflict") {
                const conflictResult = {
                  type: "options" as const,
                  placeholder: t("commands.saveMapAsConflict", {
                    name: trimmedName,
                  }),
                  commands: [
                    {
                      name: t("commands.saveMapAsOverwrite"),
                      description: t("commands.saveMapAsOverwriteDesc"),
                      callback: () => {
                        overwriteMap(result.existingId, trimmedName);
                      },
                    },
                    {
                      name: t("commands.saveMapAsNewName"),
                      description: t("commands.saveMapAsNewNameDesc"),
                      callback: () => ({
                        type: "prompt" as const,
                        placeholder: t("commands.saveMapAsNamePrompt"),
                        callback: handleSave,
                      }),
                    },
                  ],
                };
                return conflictResult;
              }
            };

            return {
              type: "prompt" as const,
              placeholder: t("commands.saveMapAsNamePrompt"),
              callback: handleSave,
            };
          },
        },
        {
          name: t("commands.saveMapAsExport"),
          description: t("commands.saveMapAsExportDesc"),
          callback: () => ({
            type: "prompt" as const,
            placeholder: t("commands.saveMapAsNamePrompt"),
            callback: (name: string) => {
              if (!name.trim()) {
                addChatMessage("Map name cannot be empty");
                return;
              }

              const packed = buildPackedMapFromEditor();
              const validation = validatePackedMap(packed);

              if (!validation.valid) {
                const errorMessages = validation.errors.map(
                  formatValidationError,
                ).join(", ");
                addChatMessage(`Map validation failed: ${errorMessages}`);
                return;
              }

              const { name: _, ...packedWithoutName } = packed;
              const packedWithName = {
                name: name.trim(),
                ...packedWithoutName,
              };
              exportLocalMapToFile(name.trim(), packedWithName);
              editorMapModifiedVar(false);
            },
          }),
        },
      ],
    }),
  }), [t]);
};
