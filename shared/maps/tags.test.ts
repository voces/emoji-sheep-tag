import { describe, it } from "@std/testing/bdd";
import { expect } from "@std/expect";
import {
  applyTagTileChange,
  countTagTiles,
  END_TILE,
  generateMapTags,
  PEN_TILE,
  START_TILE,
  tagsFromCounts,
} from "./tags.ts";

describe("generateMapTags", () => {
  it("returns no tags when no special tiles are present", () => {
    expect(generateMapTags([[0, 0], [0, 0]])).toEqual([]);
  });

  it("tags survival when at least one pen tile exists", () => {
    expect(generateMapTags([[0, PEN_TILE], [0, 0]])).toEqual(["survival"]);
  });

  it("tags bulldog only when both start and end exist", () => {
    expect(generateMapTags([[START_TILE, 0], [0, 0]])).toEqual([]);
    expect(generateMapTags([[0, END_TILE], [0, 0]])).toEqual([]);
    expect(generateMapTags([[START_TILE, END_TILE]])).toEqual(["bulldog"]);
  });

  it("supports both tags simultaneously", () => {
    expect(generateMapTags([[PEN_TILE, START_TILE, END_TILE]])).toEqual([
      "survival",
      "bulldog",
    ]);
  });
});

describe("incremental tag counts", () => {
  it("applyTagTileChange short-circuits when neither tile is special", () => {
    const counts = countTagTiles([[0, 0], [3, 4]]);
    expect(applyTagTileChange(counts, 3, 4)).toBe(false);
  });

  it("tracks pen/start/end transitions", () => {
    const counts = countTagTiles([[0, 0]]);
    expect(applyTagTileChange(counts, 0, PEN_TILE)).toBe(true);
    expect(tagsFromCounts(counts)).toEqual(["survival"]);

    expect(applyTagTileChange(counts, 0, START_TILE)).toBe(true);
    expect(tagsFromCounts(counts)).toEqual(["survival"]);

    expect(applyTagTileChange(counts, 0, END_TILE)).toBe(true);
    expect(tagsFromCounts(counts)).toEqual(["survival", "bulldog"]);

    expect(applyTagTileChange(counts, PEN_TILE, 0)).toBe(true);
    expect(tagsFromCounts(counts)).toEqual(["bulldog"]);
  });
});
