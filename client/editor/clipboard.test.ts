import "global-jsdom/register";
import { afterEach, beforeEach, describe, it } from "@std/testing/bdd";
import { expect } from "@std/expect";
import { app, Entity } from "../ecs.ts";
import { selection } from "../systems/selection.ts";
import { normalizeBuildPosition } from "../controls/blueprintHandlers.ts";

// Mock navigator.clipboard
const clipboardData: { text: string } = { text: "" };
Object.defineProperty(globalThis, "navigator", {
  value: {
    clipboard: {
      writeText: (text: string) => Promise.resolve(clipboardData.text = text),
      readText: () => Promise.resolve(clipboardData.text),
    },
  },
  writable: true,
});

// Import after mocking
const {
  copySelectedDoodads,
  startPaste,
  updatePasteBlueprints,
  cancelPaste,
  isPasting,
} = await import("./clipboard.ts");

describe("clipboard copy/paste", () => {
  beforeEach(() => {
    for (const entity of app.entities) app.removeEntity(entity);
    for (const entity of selection) delete (entity as Entity).selected;
    clipboardData.text = "";
  });

  afterEach(() => {
    cancelPaste();
  });

  it("should preserve relative positions in blueprint when pasting two 2x2 doodads side by side", async () => {
    // Create two shacks (2x2) at properly snapped positions
    // For 2x2, valid positions are offset-half: 0.75, 2.75, etc.
    const shack1 = app.addEntity({
      id: "shack-1",
      prefab: "shack",
      position: { x: 0.75, y: 5.75 },
      isDoodad: true,
    });
    (shack1 as Entity).selected = true;

    const shack2 = app.addEntity({
      id: "shack-2",
      prefab: "shack",
      position: { x: 2.75, y: 5.75 },
      isDoodad: true,
    });
    (shack2 as Entity).selected = true;

    // Copy the selected doodads
    const copyResult = await copySelectedDoodads();
    expect(copyResult).toBe(true);

    // Verify clipboard data
    const data = JSON.parse(clipboardData.text);
    expect(data.type).toBe("emoji-sheep-tag-doodads");
    expect(data.entities.length).toBe(2);
    expect(data.anchorPrefab).toBe("shack");

    // Check center and relative positions
    // Center should be (0.75 + 2.75) / 2 = 1.75
    expect(data.center.x).toBe(1.75);

    // Relative positions should be -1 and +1
    const positions = data.entities.map((e: { position: { x: number } }) =>
      e.position.x
    );
    expect(positions).toContain(-1);
    expect(positions).toContain(1);

    // Clear selection
    delete (shack1 as Entity).selected;
    delete (shack2 as Entity).selected;

    // Start paste
    const pasteResult = await startPaste();
    expect(pasteResult).toBe(true);
    expect(isPasting()).toBe(true);

    // Update paste position to x=10.0
    updatePasteBlueprints(10.0, 5.75);

    // Find the paste blueprints (they have IDs starting with "paste-blueprint-")
    const blueprints = Array.from(app.entities).filter(
      (e) => e.id.startsWith("paste-blueprint-"),
    );
    expect(blueprints.length).toBe(2);

    // Get their x positions and sort them
    const blueprintPositions = blueprints.map((e) => e.position!.x).sort((
      a,
      b,
    ) => a - b);

    // For 2x2 (offset-half), 10.0 should snap to 10.25
    // offset-half: (Math.round(10.0 / 0.5 + 0.5) - 0.5) * 0.5 = (21 - 0.5) * 0.5 = 10.25
    // So positions should be 10.25 + (-1) = 9.25 and 10.25 + 1 = 11.25
    expect(blueprintPositions[0]).toBeCloseTo(9.25, 5);
    expect(blueprintPositions[1]).toBeCloseTo(11.25, 5);

    // The distance between them should still be 2.0 (preserved)
    expect(blueprintPositions[1] - blueprintPositions[0]).toBeCloseTo(2.0, 5);
  });

  it("should verify offset-half snapping for 2x2 buildings", () => {
    // 2x2 has width 2, so 2 % 4 !== 0, uses offset-half
    const [x] = normalizeBuildPosition(10.0, 5.0, "shack");

    // offset-half: (Math.round(10.0 / 0.5 + 0.5) - 0.5) * 0.5
    // = (Math.round(20.5) - 0.5) * 0.5 = (21 - 0.5) * 0.5 = 10.25
    expect(x).toBe(10.25);

    // Test other values
    const [x2] = normalizeBuildPosition(10.3, 5.0, "shack");
    expect(x2).toBe(10.25);

    const [x3] = normalizeBuildPosition(10.5, 5.0, "shack");
    expect(x3).toBe(10.75);
  });

  it("should preserve relative positions for 4x4 buildings using half snapping", async () => {
    // Huts are 4x4, which use "half" mode (positions at 0, 0.5, 1, 1.5, etc.)
    const hut1 = app.addEntity({
      id: "hut-1",
      prefab: "hut",
      position: { x: 1.0, y: 5.0 }, // Valid half position
      isDoodad: true,
    });
    (hut1 as Entity).selected = true;

    const hut2 = app.addEntity({
      id: "hut-2",
      prefab: "hut",
      position: { x: 5.0, y: 5.0 }, // 4 tiles apart (appropriate for 4x4)
      isDoodad: true,
    });
    (hut2 as Entity).selected = true;

    await copySelectedDoodads();

    const data = JSON.parse(clipboardData.text);
    expect(data.anchorPrefab).toBe("hut");
    expect(data.center.x).toBe(3.0); // (1 + 5) / 2 = 3

    delete (hut1 as Entity).selected;
    delete (hut2 as Entity).selected;
    await startPaste();

    updatePasteBlueprints(10.0, 5.0);

    const blueprints = Array.from(app.entities).filter(
      (e) => e.id.startsWith("paste-blueprint-"),
    );
    const positions = blueprints.map((e) => e.position!.x).sort((a, b) =>
      a - b
    );

    // For 4x4 (half mode), 10.0 snaps to 10.0
    // Center at 10.0, relative offsets -2 and +2
    expect(positions[0]).toBeCloseTo(8.0, 5);
    expect(positions[1]).toBeCloseTo(12.0, 5);

    // Distance should be 4.0 (preserved)
    expect(positions[1] - positions[0]).toBeCloseTo(4.0, 5);
  });

  it("should handle entities at non-snapped positions (e.g., from map files)", async () => {
    // Simulate entities loaded from a map file at integer positions (not snapped)
    const shack1 = app.addEntity({
      id: "shack-1",
      prefab: "shack",
      position: { x: 1.0, y: 5.0 }, // Not a valid offset-half position
      isDoodad: true,
    });
    (shack1 as Entity).selected = true;

    const shack2 = app.addEntity({
      id: "shack-2",
      prefab: "shack",
      position: { x: 3.0, y: 5.0 }, // Not a valid offset-half position
      isDoodad: true,
    });
    (shack2 as Entity).selected = true;

    // Original distance is 2.0 tiles
    expect(shack2.position!.x - shack1.position!.x).toBe(2.0);

    // Copy
    await copySelectedDoodads();

    const data = JSON.parse(clipboardData.text);
    // Raw center is 2.0, but it gets snapped to offset-half: 2.25
    expect(data.center.x).toBe(2.25);

    // Relative positions: 1.0 - 2.25 = -1.25 and 3.0 - 2.25 = 0.75
    const relPositions = data.entities.map((e: { position: { x: number } }) =>
      e.position.x
    ).sort((a: number, b: number) => a - b);
    expect(relPositions[0]).toBeCloseTo(-1.25, 5);
    expect(relPositions[1]).toBeCloseTo(0.75, 5);

    // Clear selection and start paste
    delete (shack1 as Entity).selected;
    delete (shack2 as Entity).selected;
    await startPaste();

    // Update to mouse position 10.0
    updatePasteBlueprints(10.0, 5.0);

    const blueprints = Array.from(app.entities).filter(
      (e) => e.id.startsWith("paste-blueprint-"),
    );
    const positions = blueprints.map((e) => e.position!.x).sort((a, b) =>
      a - b
    );

    // For 2x2 (offset-half), 10.0 snaps to 10.25
    // positions: 10.25 + (-1.25) = 9.0 and 10.25 + 0.75 = 11.0
    expect(positions[0]).toBeCloseTo(9.0, 5);
    expect(positions[1]).toBeCloseTo(11.0, 5);

    // Distance should STILL be 2.0 (preserved relative positions)
    expect(positions[1] - positions[0]).toBeCloseTo(2.0, 5);
  });

  it("should paste fences at valid grid positions (regression test)", async () => {
    // This is the exact scenario from the bug report:
    // Two fences 0.5 tiles apart, center at non-snapped position
    const fence1 = app.addEntity({
      id: "fence-1",
      prefab: "fence",
      position: { x: 33.25, y: 40.25 }, // Valid offset-half
      isDoodad: true,
    });
    (fence1 as Entity).selected = true;

    const fence2 = app.addEntity({
      id: "fence-2",
      prefab: "fence",
      position: { x: 33.75, y: 40.25 }, // Valid offset-half, 0.5 apart
      isDoodad: true,
    });
    (fence2 as Entity).selected = true;

    await copySelectedDoodads();

    const data = JSON.parse(clipboardData.text);
    // Raw center: (33.25 + 33.75) / 2 = 33.5
    // Snapped center (offset-half): 33.75
    expect(data.center.x).toBe(33.75);

    // Relative positions: 33.25 - 33.75 = -0.5 and 33.75 - 33.75 = 0
    const relPositions = data.entities.map((e: { position: { x: number } }) =>
      e.position.x
    ).sort((a: number, b: number) => a - b);
    expect(relPositions[0]).toBeCloseTo(-0.5, 5);
    expect(relPositions[1]).toBeCloseTo(0, 5);

    delete (fence1 as Entity).selected;
    delete (fence2 as Entity).selected;
    await startPaste();

    // Paste at position 10.0
    updatePasteBlueprints(10.0, 40.25);

    const blueprints = Array.from(app.entities).filter(
      (e) => e.id.startsWith("paste-blueprint-"),
    );
    const positions = blueprints.map((e) => e.position!.x).sort((a, b) =>
      a - b
    );

    // Snapped center: 10.25 (offset-half)
    // Positions: 10.25 + (-0.5) = 9.75 and 10.25 + 0 = 10.25
    // Both 9.75 and 10.25 ARE valid offset-half positions!
    expect(positions[0]).toBeCloseTo(9.75, 5);
    expect(positions[1]).toBeCloseTo(10.25, 5);

    // Distance preserved at 0.5
    expect(positions[1] - positions[0]).toBeCloseTo(0.5, 5);

    // Verify both positions are valid offset-half (x.25 or x.75)
    for (const pos of positions) {
      const frac = pos - Math.floor(pos);
      expect(frac === 0.25 || frac === 0.75).toBe(true);
    }
  });
});
