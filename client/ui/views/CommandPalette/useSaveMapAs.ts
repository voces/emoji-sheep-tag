import { useMemo } from "react";
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

export const useSaveMapAs = () =>
  useMemo(() => ({
    name: "Save map as",
    description: "Save the current map with a new name",
    valid: editorVar,
    callback: () => ({
      type: "options" as const,
      placeholder: "Save option",
      commands: [
        {
          name: "Save to browser",
          description: "Save the map to browser storage",
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
                  placeholder: `A map named "${trimmedName}" already exists`,
                  commands: [
                    {
                      name: "Overwrite",
                      description: "Overwrite the existing map",
                      callback: () => {
                        overwriteMap(result.existingId, trimmedName);
                      },
                    },
                    {
                      name: "New name",
                      description: "Choose a different name",
                      callback: () => ({
                        type: "prompt" as const,
                        placeholder: "Map name",
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
              placeholder: "Map name",
              callback: handleSave,
            };
          },
        },
        {
          name: "Export to file",
          description: "Download the map as a JSON file",
          callback: () => ({
            type: "prompt" as const,
            placeholder: "Map name",
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
  }), []);
