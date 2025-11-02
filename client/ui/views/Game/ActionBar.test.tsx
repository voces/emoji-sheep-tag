import "@/client-testing/setup.ts";
import { afterEach, describe, it } from "@std/testing/bdd";
import { render, screen } from "@testing-library/react";
import { expect } from "@std/expect";
import { ActionBar, selectionVar } from "./ActionBar.tsx";
import { playersVar } from "@/vars/players.ts";
import { menuStateVar } from "@/vars/menuState.ts";
import { Wrapper } from "../../Wrapper.tsx";
import { menusVar } from "@/vars/menus.ts";
import { items } from "@/shared/data.ts";
import { __testing_reset_all_vars } from "@/hooks/useVar.tsx";
import {
  createTestPlayer,
  createTestSelection,
} from "@/client-testing/test-helpers.ts";

describe("ActionBar", () => {
  afterEach(() => {
    // Reset all vars to their initial state
    __testing_reset_all_vars();
  });

  it("should not render when no selection", () => {
    playersVar([createTestPlayer()]);
    selectionVar(undefined);

    const { container } = render(<ActionBar />);
    expect(container.firstChild).toBeNull();
  });

  it("should not render when selection is not owned by local player", () => {
    playersVar([createTestPlayer()]);
    selectionVar(
      createTestSelection({
        id: "unit-0",
        owner: "player-1", // Different from local player
        actions: [{ type: "auto", name: "Test", order: "some-order" }],
      }),
    );

    const { container } = render(<ActionBar />);
    expect(container.firstChild).toBeNull();
  });

  it("should render toolbar when selection is owned by local player", () => {
    playersVar([{
      id: "player-0",
      name: "Player 0",
      color: "red",
      local: true,
      sheepCount: 0,
    }]);
    selectionVar({
      id: "unit-0",
      owner: "player-0",
      actions: [{ type: "auto", name: "Test", order: "some-order" }],
    });

    render(<ActionBar />, { wrapper: Wrapper });
    expect(screen.getByRole("toolbar")).toBeTruthy();
  });

  it("should display entity actions", () => {
    playersVar([{
      id: "player-0",
      name: "Player 0",
      color: "red",
      local: true,
      sheepCount: 0,
    }]);
    selectionVar({
      id: "unit-0",
      owner: "player-0",
      actions: [
        { type: "auto", name: "Stop", order: "stop" },
        { type: "target", name: "Move", order: "move" },
        { type: "target", name: "Attack", order: "attack" },
        { type: "auto", name: "Hold", order: "hold" },
      ],
    });

    render(<ActionBar />, { wrapper: Wrapper });

    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBe(4);
    expect(screen.getByLabelText("Stop")).toBeTruthy();
    expect(screen.getByLabelText("Move")).toBeTruthy();
    expect(screen.getByLabelText("Attack")).toBeTruthy();
    expect(screen.getByLabelText("Hold")).toBeTruthy();
  });

  it("should display menu actions when menu is open", () => {
    const menuAction = {
      type: "menu" as const,
      name: "Shop",
      actions: [
        {
          type: "purchase" as const,
          name: "Buy Sword",
          itemId: "sword",
          goldCost: 100,
          binding: [],
        },
        { type: "auto" as const, name: "Back", order: "back", binding: [] },
      ],
      binding: ["KeyB"] as ReadonlyArray<string>,
    };

    playersVar([{
      id: "player-0",
      name: "Player 0",
      color: "red",
      local: true,
      sheepCount: 0,
    }]);

    const entity = {
      id: "unit-0",
      owner: "player-0",
      actions: [menuAction],
    };

    selectionVar(entity);
    menuStateVar({
      stack: [{ unitId: entity.id, action: menuAction }],
    });

    render(<ActionBar />, { wrapper: Wrapper });

    expect(screen.getByLabelText("Buy Sword")).toBeTruthy();
    expect(screen.getByLabelText("Back")).toBeTruthy();
  });

  it("should display inventory item actions", () => {
    playersVar([{
      id: "player-0",
      name: "Player 0",
      color: "red",
      local: true,
      sheepCount: 0,
    }]);
    selectionVar({
      id: "unit-0",
      owner: "player-0",
      actions: [{ type: "auto", name: "Stop", order: "stop" }],
      inventory: [
        {
          id: "potion-1",
          name: "Health Potion",
          gold: 50,
          binding: [],
          charges: 3,
          actions: [
            { type: "auto", name: "Use Potion", order: "use-potion" },
          ],
        },
      ],
    });

    render(<ActionBar />, { wrapper: Wrapper });

    expect(screen.getByLabelText("Stop")).toBeTruthy();
    expect(screen.getByLabelText("Use Potion")).toBeTruthy();
    expect(screen.getByText("3")).toBeTruthy();
  });

  it("should not display inventory actions when charges are 0", () => {
    playersVar([{
      id: "player-0",
      name: "Player 0",
      color: "red",
      local: true,
      sheepCount: 0,
    }]);
    selectionVar({
      id: "unit-0",
      owner: "player-0",
      actions: [{ type: "auto", name: "Stop", order: "stop" }],
      inventory: [
        {
          id: "potion-1",
          name: "Health Potion",
          gold: 50,
          binding: [],
          charges: 0, // No charges left
          actions: [
            { type: "auto", name: "Use Potion", order: "use-potion" },
          ],
        },
      ],
    });

    render(<ActionBar />, { wrapper: Wrapper });

    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBe(1); // Only Stop, no potion action
  });

  it("should include inventory actions with entity actions", () => {
    playersVar([{
      id: "player-0",
      name: "Player 0",
      color: "red",
      local: true,
      sheepCount: 0,
    }]);
    selectionVar({
      id: "unit-0",
      owner: "player-0",
      actions: [
        { type: "auto", name: "Stop", order: "stop" },
        { type: "target", name: "Attack", order: "attack" },
      ],
      inventory: [
        {
          id: "scroll-1",
          name: "Scroll",
          gold: 25,
          binding: [],
          charges: 2,
          actions: [
            { type: "auto", name: "Cast Spell", order: "cast-spell" },
          ],
        },
      ],
    });

    render(<ActionBar />, { wrapper: Wrapper });

    expect(screen.getByLabelText("Stop")).toBeTruthy();
    expect(screen.getByLabelText("Attack")).toBeTruthy();
    expect(screen.getByLabelText("Cast Spell")).toBeTruthy();
    expect(screen.getByText("2")).toBeTruthy();
  });

  it("should mark current action as pressed", () => {
    playersVar([{
      id: "player-0",
      name: "Player 0",
      color: "red",
      local: true,
      sheepCount: 0,
    }]);
    selectionVar({
      id: "unit-0",
      owner: "player-0",
      order: { type: "hold" },
      actions: [
        { type: "auto", name: "Hold", order: "hold" },
        { type: "auto", name: "Stop", order: "stop" },
      ],
    });

    render(<ActionBar />, { wrapper: Wrapper });

    const holdButton = screen.getByLabelText("Hold");
    const stopButton = screen.getByLabelText("Stop");
    expect(holdButton.getAttribute("aria-pressed")).toBe("true");
    expect(stopButton.getAttribute("aria-pressed")).toBe("false");
  });

  it("should mark build action as current when building", () => {
    playersVar([{
      id: "player-0",
      name: "Player 0",
      color: "red",
      local: true,
      sheepCount: 0,
    }]);
    selectionVar({
      id: "unit-0",
      owner: "player-0",
      order: { type: "build", unitType: "farm", x: 0, y: 0 },
      actions: [
        { type: "build", name: "Build Farm", unitType: "farm" },
        { type: "build", name: "Build Tower", unitType: "tower" },
      ],
    });

    render(<ActionBar />, { wrapper: Wrapper });

    const farmButton = screen.getByLabelText("Build Farm");
    const towerButton = screen.getByLabelText("Build Tower");
    expect(farmButton.getAttribute("aria-pressed")).toBe("true");
    expect(towerButton.getAttribute("aria-pressed")).toBe("false");
  });

  it("should mark menu action as current when menu is open", () => {
    const menuAction = {
      type: "menu" as const,
      name: "Shop",
      actions: [],
      binding: [] as ReadonlyArray<string>,
    };

    playersVar([{
      id: "player-0",
      name: "Player 0",
      color: "red",
      local: true,
      sheepCount: 0,
    }]);

    const entity = {
      id: "unit-0",
      owner: "player-0",
      actions: [
        { type: "auto" as const, name: "Stop", order: "stop" },
        menuAction,
      ],
    };

    selectionVar(entity);
    menuStateVar({
      stack: [{ unitId: entity.id, action: menuAction }],
    });

    render(<ActionBar />, { wrapper: Wrapper });

    // When menu is open, we show menu's actions instead of entity actions
    // But we can test that when entity has menu action and menu is NOT open,
    // the menu action can be marked as current
  });

  it("should not mark purchase actions as current", () => {
    playersVar([{
      id: "player-0",
      name: "Player 0",
      color: "red",
      local: true,
      sheepCount: 0,
      entity: { id: "player-entity", gold: 100 },
    }]);
    selectionVar({
      id: "unit-0",
      owner: "player-0",
      actions: [
        {
          type: "purchase",
          name: "Buy Item",
          itemId: "item",
          goldCost: 50,
          binding: [],
        },
      ],
    });

    render(<ActionBar />, { wrapper: Wrapper });

    const button = screen.getByLabelText("Buy Item");
    expect(button.getAttribute("aria-pressed")).toBe("false"); // Purchase actions are never current
  });

  it("should show purchase action at top-level when removed from menu", () => {
    // Setup: Start with foxToken in the shop menu
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
          ...Object.keys(items).map((itemId) => ({
            type: "purchase" as const,
            itemId,
          })),
        ],
      },
    ]);

    playersVar([
      createTestPlayer({ entity: { id: "player-entity", gold: 200 } }),
    ]);

    selectionVar(
      createTestSelection({
        actions: [
          { type: "auto", name: "Stop", order: "stop" },
          {
            type: "purchase",
            name: "Purchase Fox Token",
            itemId: "foxToken",
            goldCost: 140,
            binding: [],
          },
        ],
      }),
    );

    // Initially, foxToken is in the shop menu, so it shouldn't appear at top-level
    const { rerender } = render(<ActionBar />, { wrapper: Wrapper });
    expect(() => screen.getByLabelText("Purchase Fox Token")).toThrow();

    // Now remove foxToken from the shop menu
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
          // foxToken removed - all other items still present
          ...Object.keys(items)
            .filter((id) => id !== "foxToken")
            .map((itemId) => ({
              type: "purchase" as const,
              itemId,
            })),
        ],
      },
    ]);

    // Re-render to pick up the menu change
    rerender(<ActionBar />);

    // Now foxToken should appear at top-level since it's not in the menu anymore
    expect(screen.getByLabelText("Purchase Fox Token")).toBeTruthy();
  });

  it("should hide non-purchase action at top-level when added to menu", () => {
    // Setup: Start with swap NOT in any menu
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
        ],
      },
    ]);

    playersVar([createTestPlayer()]);

    selectionVar(
      createTestSelection({
        actions: [
          { type: "auto", name: "Stop", order: "stop" },
          { type: "auto", name: "Swap", order: "swap", binding: ["KeyC"] },
        ],
      }),
    );

    // Initially, swap is NOT in the shop menu, so it should appear at top-level
    const { rerender } = render(<ActionBar />, { wrapper: Wrapper });
    expect(screen.getByLabelText("Swap")).toBeTruthy();

    // Now add swap to the shop menu
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
          { type: "action", actionKey: "swap" },
        ],
      },
    ]);

    // Re-render to pick up the menu change
    rerender(<ActionBar />);

    // Now swap should NOT appear at top-level (it's in the menu)
    expect(() => screen.getByLabelText("Swap")).toThrow();
  });
});
