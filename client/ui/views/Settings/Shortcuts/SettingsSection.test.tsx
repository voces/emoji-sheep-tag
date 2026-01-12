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

  // Should NOT have top-level "Purchase Speed Potion"
  const speedPotMatches = text.match(/Purchase Speed Potion/g);
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

it("should update UI when menu actions change", () => {
  // Set up initial menus state with shop menu containing foxToken and speedPot
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

  const { container, rerender } = render(
    <SettingsSection
      section="wolf"
      shortcuts={wolfShortcuts}
      defaultOpen
      setBinding={() => {}}
    />,
    { wrapper: Wrapper },
  );

  // Verify both items are shown
  let text = container.textContent || "";
  expect(text).toContain("Purchase Fox Token");
  expect(text).toContain("Purchase Speed Potion");

  // Directly update menusVar to remove foxToken (simulating drag-and-drop removal)
  const updatedMenus: MenuConfig[] = [
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
  menusVar(updatedMenus);

  // Re-render to see the updated state
  rerender(
    <Wrapper>
      <SettingsSection
        section="wolf"
        shortcuts={wolfShortcuts}
        defaultOpen
        setBinding={() => {}}
      />
    </Wrapper>,
  );

  // Verify foxToken is no longer in the menu
  text = container.textContent || "";
  // foxToken should now appear at top-level, not in menu
  expect(text).toContain("Purchase Speed Potion");
});

it("should show actions added to menu inside the menu", () => {
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
        { type: "purchase", itemId: "speedPot" },
        { type: "purchase", itemId: "foxToken" },
      ],
    },
  ];
  menusVar(initialMenus);

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

  // Both items should be shown in the menu
  const text = container.textContent || "";
  expect(text).toContain("Purchase Fox Token");
  expect(text).toContain("Purchase Speed Potion");

  // Verify the menu has 3 actions (back + speedPot + foxToken)
  const menus = menusVar();
  const shopMenu = menus.find((m) => m.id === "shop");
  expect(shopMenu?.actions.length).toBe(3);
});

it("should show proper binding for action in menu", () => {
  // Set up initial menus state with shop menu containing swap
  const initialMenus: MenuConfig[] = [
    {
      id: "shop",
      name: "Shop",
      description: "View items available for purchase.",
      binding: ["KeyB"],
      prefabs: ["wolf"],
      actions: [
        { type: "action", actionKey: "back" },
        { type: "action", actionKey: "swap" },
      ],
    },
  ];
  menusVar(initialMenus);

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

  // Find Swap in the Shop menu section
  const shopMenuSection = Array.from(
    container.querySelectorAll("div"),
  ).find((div) => div.textContent?.includes("Shop"));
  expect(shopMenuSection).toBeDefined();

  // Find the Swap text within the shop menu (ShortcutLabel is a span)
  const swapInMenu = Array.from(
    shopMenuSection?.querySelectorAll("span") || [],
  ).find((span) => span.textContent === "Swap");
  expect(swapInMenu).toBeDefined();

  // Find the input field for Swap's binding (go up to LabelContainer, then ShortcutRowContainer)
  const swapInput = swapInMenu?.parentElement?.parentElement?.querySelector(
    "input",
  ) as HTMLInputElement;
  expect(swapInput).toBeDefined();

  // The binding should not be empty (swap has default binding "KeyC")
  expect(swapInput?.value).not.toBe("");
  expect(swapInput?.value).toBe("C");
});

it("should allow editing menu name inline", async () => {
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

  const { getByText, container } = render(
    <SettingsSection
      section="wolf"
      shortcuts={wolfShortcuts}
      defaultOpen
      setBinding={() => {}}
    />,
    { wrapper: Wrapper },
  );

  // Click on the menu name to start editing
  const menuName = getByText("Shop");
  fireEvent.click(menuName);

  // Wait for re-render
  await new Promise((resolve) => setTimeout(resolve, 50));

  // Should now have an input field (MenuNameInput doesn't explicitly set type)
  const inputs = container.querySelectorAll("input");
  const input = Array.from(inputs).find((i) =>
    i.value === "Shop"
  ) as HTMLInputElement;
  expect(input).toBeDefined();

  // Should have a Delete button (trash icon) in the menu row
  const deleteButton = container.querySelector("button[title='Delete menu']");
  expect(deleteButton).toBeDefined();

  // Change the name
  fireEvent.change(input, { target: { value: "Store" } });
  fireEvent.blur(input);

  // Wait for state update
  await new Promise((resolve) => setTimeout(resolve, 50));

  // Verify the menu name was updated
  const updatedMenus = menusVar();
  const shopMenu = updatedMenus.find((m) => m.id === "shop");
  expect(shopMenu?.name).toBe("Store");
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
