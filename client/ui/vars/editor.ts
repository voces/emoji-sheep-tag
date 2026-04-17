import { makeVar } from "@/hooks/useVar.tsx";

export const editorVar = makeVar<boolean>(false);
export const editorMapModifiedVar = makeVar<boolean>(false);
export const editorCurrentMapVar = makeVar<
  { id: string; name: string } | undefined
>(undefined);
export const editorHideUIVar = makeVar<boolean>(false);

/** Current water level (in cliff units) used when painting water. */
export const editorWaterLevelVar = makeVar<number>(1.25);

export type EditorWaterView = "hide" | "normal" | "level";
/** How water is visualized in the editor. "level" shows masked cells even where the ground is above water. */
export const editorWaterViewVar = makeVar<EditorWaterView>("normal");

/** Routes tile-blueprint clicks: "tile" = paint tile or route via vertexColor sentinels (cliffs), "paintWater" = set water mask. */
export type EditorTileMode = "tile" | "paintWater";
export const editorTileModeVar = makeVar<EditorTileMode>("tile");
