import { afterEach, describe, it } from "@std/testing/bdd";
import { expect } from "@std/expect";
import {
  createInitialShortcuts,
  defaultBindings,
  getActionDisplayName,
} from "./shortcutUtils.ts";
import { __testing_reset_all_vars } from "@/hooks/useVar.tsx";

describe("shortcutUtils", () => {
  afterEach(() => {
    // Clear localStorage and reset all vars to ensure tests have clean state
    localStorage.clear();
    __testing_reset_all_vars();
  });
  describe("defaultBindings", () => {
    it("should include core wolf actions", () => {
      const wolfShortcuts = defaultBindings["wolf"];

      // Should have core wolf actions
      expect(wolfShortcuts["attack"]).toBeDefined();
      expect(wolfShortcuts["mirrorImage"]).toBeDefined();
    });
  });

  describe("createInitialShortcuts", () => {
    it("should include core wolf actions", () => {
      const shortcuts = createInitialShortcuts();
      const wolfShortcuts = shortcuts["wolf"];

      // Should have core wolf actions
      expect(wolfShortcuts["attack"]).toBeDefined();
      expect(wolfShortcuts["mirrorImage"]).toBeDefined();
    });
  });

  describe("getActionDisplayName", () => {
    it("should handle purchase actions", () => {
      // Test purchase action display names with menu prefix
      expect(getActionDisplayName("menu-shop.purchase-foxToken", "wolf")).toBe(
        "Purchase Fox Token",
      );
      expect(getActionDisplayName("menu-shop.purchase-speedPot", "wolf")).toBe(
        "Purchase Potion of Speed",
      );

      // Test legacy purchase action display names (without menu prefix)
      expect(getActionDisplayName("purchase-foxToken", "wolf")).toBe(
        "Purchase Fox Token",
      );
      expect(getActionDisplayName("purchase-speedPot", "wolf")).toBe(
        "Purchase Potion of Speed",
      );
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
