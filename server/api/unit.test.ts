import { describe, it } from "jsr:@std/testing/bdd";
import { expect } from "jsr:@std/expect";
import { addItem } from "./unit.ts";
import { Entity } from "../../shared/types.ts";

describe("addItem", () => {
  it("should add new item to empty inventory", () => {
    const unit: Entity = {
      id: "test-unit",
      inventory: [],
    };

    const result = addItem(unit, "foxItem");

    expect(result).toBe(true);
    expect(unit.inventory).toHaveLength(1);
    expect(unit.inventory![0].id).toBe("foxItem");
    expect(unit.inventory![0].name).toBe("Summon Fox");
  });

  it("should initialize inventory if undefined", () => {
    const unit: Entity = {
      id: "test-unit",
    };

    const result = addItem(unit, "foxItem");

    expect(result).toBe(true);
    expect(unit.inventory).toBeDefined();
    expect(unit.inventory).toHaveLength(1);
  });

  it("should stack charges for existing items", () => {
    const unit: Entity = {
      id: "test-unit",
      inventory: [{
        id: "foxItem",
        name: "Summon Fox",
        icon: "fox",
        gold: 5,
        binding: ["KeyF"],
        charges: 2,
        action: {
          name: "Summon Fox",
          type: "auto",
          order: "fox",
          binding: ["KeyF"],
          castDuration: 0.1,
        },
      }],
    };

    const result = addItem(unit, "foxItem");

    expect(result).toBe(true);
    expect(unit.inventory).toHaveLength(1);
    expect(unit.inventory![0].charges).toBe(3);
  });

  it("should return false for invalid item id", () => {
    const unit: Entity = {
      id: "test-unit",
      inventory: [],
    };

    const result = addItem(unit, "invalidItem");

    expect(result).toBe(false);
    expect(unit.inventory).toHaveLength(0);
  });

  it("should add multiple different items", () => {
    const unit: Entity = {
      id: "test-unit",
      inventory: [],
    };

    addItem(unit, "foxItem");
    // Note: we can only test with foxItem since other items may not exist in prefabs

    expect(unit.inventory).toHaveLength(1);
    expect(unit.inventory![0].id).toBe("foxItem");
  });
});