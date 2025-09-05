import { describe, it } from "jsr:@std/testing/bdd";
import { expect } from "jsr:@std/expect";
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
      expect(getActionDisplayName("speedPot", "wolf")).toBe("Use Speed Potion");

      // Test purchase action display names
      expect(getActionDisplayName("purchase-foxToken", "wolf")).toBe(
        "Purchase Fox Token",
      );
      expect(getActionDisplayName("purchase-speedPot", "wolf")).toBe(
        "Purchase Speed Potion",
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
});
