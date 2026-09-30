import "global-jsdom/register";
import { afterEach, beforeEach, describe, it } from "@std/testing/bdd";
import { expect } from "@std/expect";
import "../controls.ts";
import {
  cancelBlueprint,
  getBlueprint,
} from "../controls/blueprintHandlers.ts";
import {
  editorActiveActionVar,
  editorTileModeVar,
  editorVar,
} from "@/vars/editor.ts";
import { tileDefs } from "@/shared/data.ts";
import { startTerrainTool, TERRAIN_TOOL_COLORS } from "./terrainTools.ts";

describe("startTerrainTool", () => {
  beforeEach(() => {
    editorVar(true);
    editorTileModeVar("tile");
  });

  afterEach(() => {
    cancelBlueprint();
    editorVar(false);
  });

  it("arms a hidden tile blueprint and marks the tool active", () => {
    startTerrainTool({ kind: "raise" });

    const blueprint = getBlueprint();
    expect(blueprint?.prefab).toBe("tile");
    expect(blueprint?.vertexColor).toBe(TERRAIN_TOOL_COLORS.raise);
    expect(blueprint?.alpha).toBe(0);
    expect(editorActiveActionVar()).toEqual({ kind: "raise" });
  });

  it("gives tile tools the tile's colour and pathing", () => {
    const tile = tileDefs[1];
    startTerrainTool({ kind: "tile", color: tile.color });

    expect(getBlueprint()?.vertexColor).toBe(tile.color);
    expect(getBlueprint()?.pathing).toBe(tile.pathing);
  });

  it("switches the tile mode to match the tool", () => {
    startTerrainTool({ kind: "water" });
    expect(editorTileModeVar()).toBe("paintWater");

    startTerrainTool({ kind: "unmask" });
    expect(editorTileModeVar()).toBe("paintMask");

    startTerrainTool({ kind: "select" });
    expect(editorTileModeVar()).toBe("tile");
  });

  it("leaves the tile mode alone for terrain paste", () => {
    startTerrainTool({ kind: "water" });
    startTerrainTool({ kind: "paste" });

    expect(editorTileModeVar()).toBe("paintWater");
    expect(editorActiveActionVar()).toEqual({ kind: "paste" });
  });
});
