import { beforeEach, describe, it } from "@std/testing/bdd";
import { expect } from "@std/expect";
import {
  deleteLocalMap,
  getLocalMap,
  getLocalMapByName,
  listLocalMaps,
  saveLocalMap,
} from "./localMaps.ts";
import { type PackedMap } from "@/shared/map.ts";

// Mock packed map data
const mockPackedMap: PackedMap = {
  center: { x: 50, y: 50 },
  bounds: {
    min: { x: 0, y: 0 },
    max: { x: 100, y: 100 },
  },
  terrain: "mock-terrain-data",
  cliffs: "mock-cliff-data",
  entities: "mock-entity-data",
};

describe("localMaps storage", () => {
  beforeEach(async () => {
    if (typeof indexedDB === "undefined") {
      console.log("Skipping IndexedDB tests (not in browser environment)");
      return;
    }

    const databases = await indexedDB.databases();
    for (const db of databases) {
      if (db.name === "emoji-sheep-tag") {
        indexedDB.deleteDatabase(db.name);
      }
    }
  });

  it("should save and retrieve a local map", async () => {
    if (typeof indexedDB === "undefined") return;

    const id = "test-map-1";
    const name = "Test Map";

    await saveLocalMap(id, name, mockPackedMap);

    const retrieved = await getLocalMap(id);
    expect(retrieved).toBeDefined();
    expect(retrieved?.id).toBe(id);
    expect(retrieved?.name).toBe(name);
    expect(retrieved?.data).toEqual(mockPackedMap);
    expect(retrieved?.author).toBeDefined();
    expect(retrieved?.timestamp).toBeDefined();
  });

  it("should retrieve a map by name", async () => {
    if (typeof indexedDB === "undefined") return;

    const id = "test-map-2";
    const name = "Named Map";

    await saveLocalMap(id, name, mockPackedMap);

    const retrieved = await getLocalMapByName(name);
    expect(retrieved).toBeDefined();
    expect(retrieved?.id).toBe(id);
    expect(retrieved?.name).toBe(name);
  });

  it("should list all local maps sorted by timestamp", async () => {
    if (typeof indexedDB === "undefined") return;

    await saveLocalMap("map-1", "Map 1", mockPackedMap);
    await new Promise((resolve) => setTimeout(resolve, 10));
    await saveLocalMap("map-2", "Map 2", mockPackedMap);
    await new Promise((resolve) => setTimeout(resolve, 10));
    await saveLocalMap("map-3", "Map 3", mockPackedMap);

    const maps = await listLocalMaps();
    expect(maps).toHaveLength(3);
    expect(maps[0].name).toBe("Map 3");
    expect(maps[1].name).toBe("Map 2");
    expect(maps[2].name).toBe("Map 1");
    // Verify we only get metadata, not the full data
    expect(maps[0]).not.toHaveProperty("data");
  });

  it("should update existing map when saving with same id", async () => {
    if (typeof indexedDB === "undefined") return;

    const id = "update-test";
    const originalName = "Original";
    const updatedName = "Updated";

    await saveLocalMap(id, originalName, mockPackedMap);
    const original = await getLocalMap(id);

    await new Promise((resolve) => setTimeout(resolve, 10));
    await saveLocalMap(id, updatedName, mockPackedMap);
    const updated = await getLocalMap(id);

    expect(updated?.name).toBe(updatedName);
    expect(updated?.timestamp).toBeGreaterThan(original?.timestamp ?? 0);
  });

  it("should delete a local map", async () => {
    if (typeof indexedDB === "undefined") return;

    const id = "delete-test";
    await saveLocalMap(id, "To Delete", mockPackedMap);

    let retrieved = await getLocalMap(id);
    expect(retrieved).toBeDefined();

    await deleteLocalMap(id);

    retrieved = await getLocalMap(id);
    expect(retrieved).toBeUndefined();
  });

  it("should return undefined for non-existent map", async () => {
    if (typeof indexedDB === "undefined") return;

    const retrieved = await getLocalMap("non-existent");
    expect(retrieved).toBeUndefined();
  });

  it("should return undefined for non-existent map name", async () => {
    if (typeof indexedDB === "undefined") return;

    const retrieved = await getLocalMapByName("non-existent");
    expect(retrieved).toBeUndefined();
  });
});
