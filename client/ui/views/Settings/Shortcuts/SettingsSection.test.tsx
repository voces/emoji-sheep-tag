import "@/client-testing/setup.ts";
import { afterEach, it } from "@std/testing/bdd";
import { expect } from "@std/expect";
import { fireEvent, render } from "@testing-library/react";
import { Wrapper } from "../../../Wrapper.tsx";
import { SettingsSection } from "./SettingsSection.tsx";
import { defaultBindings } from "@/util/shortcutUtils.ts";
import { type MenuConfig, menusVar } from "@/vars/menus.ts";
import { __testing_reset_all_vars } from "@/hooks/useVar.tsx";

afterEach(() => {
  // Reset all vars to their initial state
  __testing_reset_all_vars();
});

it("should not show purchase actions at top-level when they're in menu", () => {
  const wolfShortcuts = defaultBindings["wolf"];

  const { container } = render(
    <SettingsSection
      section="wolf"
      shortcuts={wolfShortcuts}
      defaultOpen
      setBinding={() => {}}
    />,
    { wrapper: Wrapper },
  );

  const text = container.textContent || "";

  // Should have the shop menu
  expect(text).toContain("Shop");

  // Should NOT have top-level purchase actions like "Purchase Fox Token"
  // They should only appear inside the menu
  const allMatches = text.match(/Purchase Fox Token/g);
  if (allMatches) {
    // Should only appear once (inside menu), not twice (top-level + menu)
    expect(allMatches.length).toBeLessThanOrEqual(1);
  }

  // Should NOT have top-level "Purchase Potion of Speed"
  const speedPotMatches = text.match(/Purchase Potion of Speed/g);
  if (speedPotMatches) {
    expect(speedPotMatches.length).toBeLessThanOrEqual(1);
  }
});

it("should show menu actions with proper bindings", () => {
  const wolfShortcuts = defaultBindings["wolf"];

  const { container } = render(
    <SettingsSection
      section="wolf"
      shortcuts={wolfShortcuts}
      defaultOpen
      setBinding={() => {}}
    />,
    { wrapper: Wrapper },
  );

  // Find all input elements
  const inputs = container.querySelectorAll("input");

  // At least some inputs should have non-empty values (bindings)
  const nonEmptyInputs = Array.from(inputs).filter((input) =>
    (input as HTMLInputElement).value !== ""
  );

  expect(nonEmptyInputs.length).toBeGreaterThan(0);
});

it("should detect conflicts within menu actions", () => {
  const wolfShortcuts = {
    ...defaultBindings["wolf"],
    "purchase-foxToken": ["KeyF"],
    "purchase-speedPot": ["KeyF"], // Conflict!
  };

  const { container } = render(
    <SettingsSection
      section="wolf"
      shortcuts={wolfShortcuts}
      defaultOpen
      setBinding={() => {}}
    />,
    { wrapper: Wrapper },
  );

  const text = container.textContent || "";

  // Should show conflict warning in the section header
  expect(text).toContain("⚠");
});

it("should allow removing an item from the shop menu", async () => {
  // Set up initial menus state with shop menu containing foxToken
  const initialMenus: MenuConfig[] = [
    {
      id: "shop",
      name: "Shop",
      description: "View items available for purchase.",
      binding: ["KeyB"],
      prefabs: ["wolf"],
      actions: [
        { type: "action", actionKey: "back" },
        { type: "purchase", itemId: "foxToken" },
        { type: "purchase", itemId: "speedPot" },
      ],
    },
  ];
  menusVar(initialMenus);

  const wolfShortcuts = defaultBindings["wolf"];

  const { container, getByText } = render(
    <SettingsSection
      section="wolf"
      shortcuts={wolfShortcuts}
      defaultOpen
      setBinding={() => {}}
    />,
    { wrapper: Wrapper },
  );

  // Click Edit button on the Shop menu
  const editButton = getByText("Edit");
  fireEvent.click(editButton);

  // Wait for re-render
  await new Promise((resolve) => setTimeout(resolve, 50));

  // Menu should now be in edit mode
  // Find the Remove button specifically for foxToken
  // It should be next to the "Purchase Fox Token" text
  const foxTokenRow = Array.from(container.querySelectorAll("p")).find((
    p,
  ) => p.textContent === "Purchase Fox Token");
  expect(foxTokenRow).toBeDefined();

  // Find the Remove button in the same row
  const removeButton = foxTokenRow?.parentElement?.querySelector(
    "button:not([aria-label])",
  ) as HTMLButtonElement;
  expect(removeButton).toBeDefined();
  expect(removeButton?.textContent).toBe("Remove");

  // Click the Remove button for foxToken
  fireEvent.click(removeButton);

  // Wait for React to process the state update
  await new Promise((resolve) => setTimeout(resolve, 100));

  // Click Save to persist changes
  const saveButton = getByText("Save");
  fireEvent.click(saveButton);

  // Wait for menusVar to be updated
  await new Promise((resolve) => setTimeout(resolve, 100));

  // Verify the final state
  const updatedMenus = menusVar();
  const shopMenu = updatedMenus.find((m) => m.id === "shop");
  expect(shopMenu).toBeDefined();

  // Should have 2 actions after removing one (back + speedPot)
  expect(shopMenu?.actions.length).toBe(2);

  // speedPot should still be in the menu
  const hasSpeedPot = shopMenu?.actions.some((action) =>
    "type" in action && action.type === "purchase" &&
    action.itemId === "speedPot"
  );
  expect(hasSpeedPot).toBe(true);
});

it("should allow adding an item to the shop menu", async () => {
  // Set up initial menus state with shop menu NOT containing foxToken
  const initialMenus: MenuConfig[] = [
    {
      id: "shop",
      name: "Shop",
      description: "View items available for purchase.",
      binding: ["KeyB"],
      prefabs: ["wolf"],
      actions: [
        { type: "action", actionKey: "back" },
        { type: "purchase", itemId: "speedPot" },
      ],
    },
  ];
  menusVar(initialMenus);

  const wolfShortcuts = defaultBindings["wolf"];

  const { container, getByText } = render(
    <SettingsSection
      section="wolf"
      shortcuts={wolfShortcuts}
      defaultOpen
      setBinding={() => {}}
    />,
    { wrapper: Wrapper },
  );

  // Click Edit button on the Shop menu
  const editButton = getByText("Edit");
  fireEvent.click(editButton);

  // Wait for re-render
  await new Promise((resolve) => setTimeout(resolve, 50));

  // Menu should now be in edit mode
  // Purchase Fox Token should have an Add button since it's not in the menu
  const addButtons = Array.from(container.querySelectorAll("button"))
    .filter((btn) => btn.textContent === "Add");

  // Should have Add buttons for items not in menu (foxToken and others)
  expect(addButtons.length).toBeGreaterThan(0);

  // Click the first Add button (for foxToken - assuming it's first in the list)
  const firstAddButton = addButtons[0] as HTMLButtonElement;
  fireEvent.click(firstAddButton);

  // Wait for re-render
  await new Promise((resolve) => setTimeout(resolve, 50));

  // Click Save to persist changes
  const saveButton = getByText("Save");
  fireEvent.click(saveButton);

  // Wait for state update
  await new Promise((resolve) => setTimeout(resolve, 50));

  // Verify the menu was updated in menusVar
  const updatedMenus = menusVar();
  const shopMenu = updatedMenus.find((m) => m.id === "shop");
  expect(shopMenu).toBeDefined();

  // The first item in the purchase list should now be in the menu
  // We added 1 action, so should have 3 total (back + speedPot + new item)
  expect(shopMenu?.actions.length).toBe(3);

  // speedPot should still be in the menu
  const hasSpeedPot = shopMenu?.actions.some((action) =>
    "type" in action && action.type === "purchase" &&
    action.itemId === "speedPot"
  );
  expect(hasSpeedPot).toBe(true);
});

it("should show proper binding for non-purchase action added to menu", async () => {
  // Set up initial menus state with shop menu NOT containing swap
  const initialMenus: MenuConfig[] = [
    {
      id: "shop",
      name: "Shop",
      description: "View items available for purchase.",
      binding: ["KeyB"],
      prefabs: ["wolf"],
      actions: [
        { type: "action", actionKey: "back" },
      ],
    },
  ];
  menusVar(initialMenus);

  const wolfShortcuts = defaultBindings["wolf"];

  const { container, getByText } = render(
    <SettingsSection
      section="wolf"
      shortcuts={wolfShortcuts}
      defaultOpen
      setBinding={() => {}}
    />,
    { wrapper: Wrapper },
  );

  // Click Edit button on the Shop menu
  const editButton = getByText("Edit");
  fireEvent.click(editButton);

  // Wait for re-render
  await new Promise((resolve) => setTimeout(resolve, 50));

  // Find the Swap action row (should be at top-level with an Add button)
  const swapRow = Array.from(container.querySelectorAll("p")).find((p) =>
    p.textContent === "Swap"
  );
  expect(swapRow).toBeDefined();

  // Find the Add button next to Swap
  const addButton = swapRow?.parentElement?.querySelector(
    "button",
  ) as HTMLButtonElement;
  expect(addButton?.textContent).toBe("Add");

  // Click Add to add Swap to the menu
  fireEvent.click(addButton);

  // Wait for re-render
  await new Promise((resolve) => setTimeout(resolve, 50));

  // Click Save to persist changes
  const saveButton = getByText("Save");
  fireEvent.click(saveButton);

  // Wait for state update
  await new Promise((resolve) => setTimeout(resolve, 50));

  // Verify the menu was updated in menusVar
  const updatedMenus = menusVar();
  const shopMenu = updatedMenus.find((m) => m.id === "shop");
  expect(shopMenu).toBeDefined();

  // Swap should now be in the menu
  const hasSwap = shopMenu?.actions.some((action) =>
    "type" in action && action.type === "action" && action.actionKey === "swap"
  );
  expect(hasSwap).toBe(true);

  // Now check that the binding shows up correctly in the menu
  // Re-render to get updated state
  const { container: newContainer } = render(
    <SettingsSection
      section="wolf"
      shortcuts={wolfShortcuts}
      defaultOpen
      setBinding={() => {}}
    />,
    { wrapper: Wrapper },
  );

  // Find Swap in the Shop menu section
  const shopMenuSection = Array.from(
    newContainer.querySelectorAll("div"),
  ).find((div) => div.textContent?.includes("Shop"));
  expect(shopMenuSection).toBeDefined();

  // Find the Swap text within the shop menu
  const swapInMenu = Array.from(
    shopMenuSection?.querySelectorAll("p") || [],
  ).find((p) => p.textContent === "Swap");
  expect(swapInMenu).toBeDefined();

  // Find the input field for Swaps binding
  const swapInput = swapInMenu?.parentElement?.querySelector(
    "input",
  ) as HTMLInputElement;
  expect(swapInput).toBeDefined();

  // The binding should not be empty (swap has default binding "KeyC")
  expect(swapInput?.value).not.toBe("");
  expect(swapInput?.value).toBe("C");
});

it("should not show conflict warning for deleted menu shortcuts", async () => {
  const { shortcutsVar } = await import("@/vars/shortcuts.ts");

  const customMenu: MenuConfig = {
    id: "custom-menu",
    name: "Custom Menu",
    binding: ["KeyC"],
    prefabs: ["wolf"],
    actions: [
      { type: "action", actionKey: "back" },
    ],
  };
  menusVar([customMenu]);

  shortcutsVar({
    ...shortcutsVar(),
    wolf: {
      ...defaultBindings["wolf"],
      swap: ["KeyC"],
      "menu-custom-menu": ["KeyC"],
    },
  });

  await new Promise((resolve) => setTimeout(resolve, 100));

  const { container, rerender } = render(
    <SettingsSection
      section="wolf"
      shortcuts={shortcutsVar().wolf}
      defaultOpen
      setBinding={() => {}}
    />,
    { wrapper: Wrapper },
  );

  let text = container.textContent || "";
  expect(text).toContain("Conflicts with: Swap, Custom Menu");

  menusVar([]);

  await new Promise((resolve) => setTimeout(resolve, 100));

  rerender(
    <SettingsSection
      section="wolf"
      shortcuts={shortcutsVar().wolf}
      defaultOpen
      setBinding={() => {}}
    />,
  );

  text = container.textContent || "";
  expect(text).not.toContain("Custom Menu");
});

it("should detect conflicts with default menu bindings", () => {
  const customMenu: MenuConfig = {
    id: "build-menu",
    name: "Build",
    binding: ["KeyB"],
    prefabs: ["sheep"],
    actions: [
      { type: "action", actionKey: "back" },
      { type: "action", actionKey: "build-farm" },
    ],
  };
  menusVar([customMenu]);

  const sheepShortcuts = {
    ...defaultBindings["sheep"],
    bite: ["KeyB"],
  };

  const { container } = render(
    <SettingsSection
      section="sheep"
      shortcuts={sheepShortcuts}
      defaultOpen
      setBinding={() => {}}
    />,
    { wrapper: Wrapper },
  );

  const text = container.textContent || "";
  expect(text).toContain("Build");
  expect(text).toContain("Conflicts with: Bite");
});
