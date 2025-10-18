import { describe, it } from "@std/testing/bdd";
import { expect } from "@std/expect";
import {
  createInitialShortcuts,
  defaultBindings,
  getActionDisplayName,
} from "./shortcutUtils.ts";
import { items } from "@/shared/data.ts";

describe("shortcutUtils", () => {
  describe("defaultBindings", () => {
    it("should include item actions from shop menu", () => {
      const wolfShortcuts = defaultBindings["wolf"];

      // Should have fox action from foxToken
      expect(wolfShortcuts["fox"]).toEqual(["KeyF"]);

      // Should have speedPot action from speedPot item
      expect(wolfShortcuts["speedPot"]).toEqual(["KeyS"]);
    });
  });

  describe("createInitialShortcuts", () => {
    it("should include item actions", () => {
      const shortcuts = createInitialShortcuts();
      const wolfShortcuts = shortcuts["wolf"];

      // Should have fox action from foxToken
      expect(wolfShortcuts["fox"]).toEqual(["KeyF"]);

      // Should have speedPot action from speedPot item
      expect(wolfShortcuts["speedPot"]).toEqual(["KeyS"]);
    });
  });

  describe("getActionDisplayName", () => {
    it("should handle item actions", () => {
      // Test item action display names
      expect(getActionDisplayName("fox", "wolf")).toBe("Summon Fox");
      expect(getActionDisplayName("speedPot", "wolf")).toBe(
        "Drink Potion of Speed",
      );

      // Test purchase action display names
      expect(getActionDisplayName("purchase-foxToken", "wolf")).toBe(
        "Purchase Fox Token",
      );
      expect(getActionDisplayName("purchase-speedPot", "wolf")).toBe(
        "Purchase Potion of Speed",
      );
    });
  });

  describe("item action collection", () => {
    it("should collect item actions from all purchase actions in menus", () => {
      const wolfShortcuts = defaultBindings["wolf"];

      // Check that we have shortcuts for all items that have actions
      for (const [itemId, item] of Object.entries(items)) {
        if (item.actions) {
          for (const itemAction of item.actions) {
            if (itemAction.type === "auto" || itemAction.type === "target") {
              const expectedKey = itemAction.order;
              // Check if this item action was collected
              if (itemId === "foxToken" || itemId === "speedPot") {
                // These items are in the wolf's shop menu
                expect(wolfShortcuts[expectedKey]).toEqual(itemAction.binding);
              }
            }
          }
        }
      }
    });
  });

  describe("cancel-upgrade shortcuts", () => {
    it("should add cancel-upgrade entry for frost castle", () => {
      // Frost castle can be upgraded to from hut
      const frostCastleShortcuts = defaultBindings["frostCastle"];

      expect(frostCastleShortcuts["cancel-upgrade"]).toEqual(["Backquote"]);
    });

    it("should add cancel-upgrade entry in createInitialShortcuts", () => {
      const shortcuts = createInitialShortcuts();
      const frostCastleShortcuts = shortcuts["frostCastle"];

      expect(frostCastleShortcuts["cancel-upgrade"]).toEqual(["Backquote"]);
    });

    it("should display correct name for cancel-upgrade", () => {
      expect(getActionDisplayName("cancel-upgrade", "frostCastle")).toBe(
        "Cancel upgrade",
      );
    });

    it("should not add cancel-upgrade for units that cannot be upgraded to", () => {
      // Wolf cannot be upgraded to
      const wolfShortcuts = defaultBindings["wolf"];

      expect(wolfShortcuts["cancel-upgrade"]).toBeUndefined();
    });
  });
});
