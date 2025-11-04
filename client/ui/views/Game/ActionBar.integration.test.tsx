import "@/client-testing/setup.ts";
import { afterEach, it } from "@std/testing/bdd";
import { render, screen } from "@testing-library/react";
import { expect } from "@std/expect";
import { ActionBar, selectionVar } from "./ActionBar.tsx";
import { Wrapper } from "../../Wrapper.tsx";
import { menusVar } from "@/vars/menus.ts";
import { __testing_reset_all_vars } from "@/hooks/useVar.tsx";
import { openMenu } from "@/vars/menuState.ts";
import {
  createTestPlayer,
  createTestSelection,
} from "@/client-testing/test-helpers.ts";
import { addEntity } from "@/shared/api/entity.ts";
import { localPlayerIdVar } from "@/vars/localPlayerId.ts";

afterEach(() => {
  __testing_reset_all_vars();
});

it("should show action with full details when in menu", () => {
  // Setup: Add mirrorImage to the shop menu
  menusVar([
    {
      id: "shop",
      name: "Shop",
      description: "View items available for purchase.",
      icon: undefined,
      binding: ["KeyB"],
      prefabs: ["wolf"],
      actions: [
        { type: "action", actionKey: "back" },
        { type: "action", actionKey: "mirrorImage" }, // Add mirrorImage to menu
      ],
    },
  ]);

  localPlayerIdVar("player-0");
  addEntity(createTestPlayer());

  const entityId = "wolf-0";

  selectionVar(
    createTestSelection({
      id: entityId,
      actions: [
        { type: "auto", name: "Stop", order: "stop" },
        {
          type: "auto",
          name: "Mirror Image",
          order: "mirrorImage",
          manaCost: 50,
          binding: ["KeyR"],
          description:
            "Creates a weak copy of your wolf which is capable of blocking the sheep and dealing minor damage to structures. Dispels all buffs.",
        },
      ],
    }),
  );

  const { rerender } = render(<ActionBar />, { wrapper: Wrapper });

  // Mirror Image should NOT be at top-level (it's in the menu)
  expect(() => screen.getByLabelText("Mirror Image")).toThrow();

  // Shop menu button should be visible (generated from menusVar)
  const shopButton = screen.getByLabelText("Shop");
  expect(shopButton).toBeTruthy();

  // Create the menu action object to pass to openMenu
  // This simulates what happens when the user clicks the shop button
  const shopMenuAction = {
    type: "menu" as const,
    name: "Shop",
    binding: ["KeyB"] as ReadonlyArray<string>,
    actions: [
      {
        type: "auto" as const,
        name: "Back",
        order: "back",
        binding: ["Backquote"],
        icon: "cancel",
      },
      {
        type: "auto" as const,
        name: "Mirror Image",
        order: "mirrorImage",
        manaCost: 50,
        binding: ["KeyR"],
        description:
          "Creates a weak copy of your wolf which is capable of blocking the sheep and dealing minor damage to structures. Dispels all buffs.",
        icon: "wolf",
        iconEffect: "mirror" as const,
      },
    ],
  };

  // Open the menu programmatically
  openMenu(shopMenuAction, entityId);

  // Re-render to pick up the menu state change
  rerender(<ActionBar />);

  // Now Mirror Image should be visible in the menu
  const mirrorImageButton = screen.getByLabelText("Mirror Image");
  expect(mirrorImageButton).toBeTruthy();

  // The button should show an icon and the hotkey
  // Check if the icon is present (it's an SVG element)
  const icon = mirrorImageButton.querySelector("svg");
  expect(icon).toBeTruthy();

  // The hotkey should be visible
  const hotkey = mirrorImageButton.querySelector("kbd");
  expect(hotkey).toBeTruthy();
  expect(hotkey?.textContent).toBe("R");

  // Verify it's not showing as lowercase "mirrorImage"
  const hasLowercaseMirrorImage =
    mirrorImageButton.textContent?.trim() === "mirrorImage";
  expect(hasLowercaseMirrorImage).toBe(false);
});
