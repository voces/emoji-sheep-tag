import { describe, it } from "jsr:@std/testing/bdd";
import { expect } from "jsr:@std/expect";
import { UnitDataAction } from "@/shared/types.ts";
import { Shortcuts } from "../ui/util/shortcutUtils.ts";
import { applyShortcutOverride } from "./applyShortcutOverrides.ts";

describe("applyShortcutOverride", () => {
  it("should apply override to item action", () => {
    const action: UnitDataAction = {
      name: "Use Speed Potion",
      type: "auto",
      order: "speedPot",
      binding: ["KeyS"],
    };

    const shortcuts: Shortcuts = {
      wolf: {
        speedPot: ["KeyU"], // Override to U key
      },
    };

    const result = applyShortcutOverride(action, shortcuts, "wolf");
    expect(result.binding).toEqual(["KeyU"]);
  });

  it("should not modify action if no override exists", () => {
    const action: UnitDataAction = {
      name: "Use Speed Potion",
      type: "auto",
      order: "speedPot",
      binding: ["KeyS"],
    };

    const shortcuts: Shortcuts = {
      wolf: {
        // No override for speedPot
      },
    };

    const result = applyShortcutOverride(action, shortcuts, "wolf");
    expect(result.binding).toEqual(["KeyS"]);
  });

  it("should not modify action if override is same as default", () => {
    const action: UnitDataAction = {
      name: "Use Speed Potion",
      type: "auto",
      order: "speedPot",
      binding: ["KeyS"],
    };

    const shortcuts: Shortcuts = {
      wolf: {
        speedPot: ["KeyS"], // Same as default
      },
    };

    const result = applyShortcutOverride(action, shortcuts, "wolf");
    expect(result).toBe(action); // Should be the same object
  });

  it("should handle actions without default bindings", () => {
    const action: UnitDataAction = {
      name: "Some Action",
      type: "auto",
      order: "someAction",
      // No binding property
    };

    const shortcuts: Shortcuts = {
      wolf: {
        someAction: ["KeyX"],
      },
    };

    const result = applyShortcutOverride(action, shortcuts, "wolf");
    expect(result.binding).toEqual(["KeyX"]);
  });

  it("should handle multi-key shortcuts", () => {
    const action: UnitDataAction = {
      name: "Complex Action",
      type: "auto",
      order: "complexAction",
      binding: ["KeyA"],
    };

    const shortcuts: Shortcuts = {
      wolf: {
        complexAction: ["ControlLeft", "KeyA"], // Ctrl+A
      },
    };

    const result = applyShortcutOverride(action, shortcuts, "wolf");
    expect(result.binding).toEqual(["ControlLeft", "KeyA"]);
  });
});
