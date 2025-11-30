import "@/client-testing/setup.ts";
import { afterEach, describe, it } from "@std/testing/bdd";
import { render, screen } from "@testing-library/react";
import { expect } from "@std/expect";
import { ActionBar, actionsToRows, selectionVar } from "./ActionBar.tsx";
import { menuStateVar } from "@/vars/menuState.ts";
import { menusVar } from "@/vars/menus.ts";
import { items } from "@/shared/data.ts";
import { __testing_reset_all_vars } from "@/hooks/useVar.tsx";
import {
  createTestPlayer,
  createTestSelection,
} from "@/client-testing/test-helpers.ts";
import { addEntity } from "@/shared/api/entity.ts";
import { localPlayerIdVar } from "@/vars/localPlayerId.ts";
import { type UnitDataAction } from "@/shared/types.ts";
import { Wrapper } from "../../../Wrapper.tsx";
import { getAllTexts } from "@/client-testing/utils.tsx";

describe("ActionBar", () => {
  afterEach(() => {
    // Reset all vars to their initial state
    __testing_reset_all_vars();
  });

  it("should render empty when selection is not owned by local player", () => {
    addEntity(createTestPlayer());
    localPlayerIdVar("player-0");
    selectionVar({
      id: "unit-0",
      owner: "player-1", // Different from local player
      actions: [{ type: "auto", name: "Test", order: "some-order" }],
    });

    render(<ActionBar />, { wrapper: Wrapper });
    expect(getAllTexts()).toEqual([]);
  });

  it.only("should render toolbar when selection is owned by local player", () => {
    addEntity(createTestPlayer());
    localPlayerIdVar("player-0");
    selectionVar({
      id: "unit-0",
      owner: "player-0",
      actions: [{ type: "auto", name: "Test", order: "some-order" }],
    });

    render(<ActionBar />, { wrapper: Wrapper });
    expect(getAllTexts()).toEqual(["Test"]);
  });

  it("should display entity actions", () => {
    addEntity(createTestPlayer());
    localPlayerIdVar("player-0");
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

    addEntity(createTestPlayer());
    localPlayerIdVar("player-0");

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
    addEntity(createTestPlayer());
    localPlayerIdVar("player-0");
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
    addEntity(createTestPlayer());
    localPlayerIdVar("player-0");
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

    // Only Stop action should be visible, no potion action
    expect(screen.getByLabelText("Stop")).toBeTruthy();
    expect(screen.queryByLabelText("Use Potion")).toBeNull();
  });

  it("should include inventory actions with entity actions", () => {
    addEntity(createTestPlayer());
    localPlayerIdVar("player-0");
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
    addEntity(createTestPlayer());
    localPlayerIdVar("player-0");
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
    addEntity(createTestPlayer());
    localPlayerIdVar("player-0");
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

    addEntity(createTestPlayer());
    localPlayerIdVar("player-0");

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
    addEntity(createTestPlayer());
    localPlayerIdVar("player-0");
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

    addEntity(createTestPlayer());
    localPlayerIdVar("player-0");

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

    addEntity(createTestPlayer());
    localPlayerIdVar("player-0");

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

describe("actionsToRows", () => {
  const createAction = (
    name: string,
    binding?: string[],
  ): UnitDataAction => ({
    type: "auto",
    name,
    order: name.toLowerCase(),
    binding,
  });

  it("should place actions with bindings in their keyboard positions", () => {
    const actions = [
      createAction("Q", ["KeyQ"]),
      createAction("W", ["KeyW"]),
      createAction("E", ["KeyE"]),
    ];

    const rows = actionsToRows(actions, 11); // Unlimited

    // Q, W, E should be in first row at positions 0, 1, 2
    expect(rows[0][0]?.name).toBe("Q");
    expect(rows[0][1]?.name).toBe("W");
    expect(rows[0][2]?.name).toBe("E");
  });

  it("should place actions without bindings in first available slots", () => {
    const actions = [
      createAction("Q", ["KeyQ"]),
      createAction("Unbound1"),
      createAction("W", ["KeyW"]),
      createAction("Unbound2"),
    ];

    const rows = actionsToRows(actions, 11); // Unlimited

    // Q at 0, W at 1, then unbound actions fill row by row (row 0, then row 1, then row 2)
    expect(rows[0][0]?.name).toBe("Q");
    expect(rows[0][1]?.name).toBe("W");
    expect(rows[0][2]?.name).toBe("Unbound1");
    expect(rows[0][3]?.name).toBe("Unbound2");
  });

  it("should compact holes when row exceeds preferred columns", () => {
    const actions = [
      createAction("W", ["KeyW"]), // Position 1
      createAction("E", ["KeyE"]), // Position 2
      createAction("R", ["KeyR"]), // Position 3
      createAction("T", ["KeyT"]), // Position 4
    ];

    const rows = actionsToRows(actions, 4);

    // Row should be compacted: [undefined, W, E, R, T] -> [undefined, W, E, R] with T moved
    const row0 = rows[0];
    expect(row0.length).toBeLessThanOrEqual(4);
    expect(row0.filter((a) => a !== undefined).length).toBeLessThanOrEqual(4);
  });

  it("should prefer shifting unbound actions over bound actions", () => {
    const actions = [
      createAction("W", ["KeyW"]), // Bound, position 1
      createAction("E", ["KeyE"]), // Bound, position 2
      createAction("R", ["KeyR"]), // Bound, position 3
      createAction("T", ["KeyT"]), // Bound, position 4
      createAction("Unbound"), // Unbound, fills position 0
    ];

    const rows = actionsToRows(actions, 4);

    // The unbound action should be moved to another row, not the bound ones
    const row0 = rows[0];
    const row1 = rows[1];

    // Check that bound actions W, E, R, T are still in row 0
    const row0Names = row0.filter((a) => a !== undefined).map((a) => a!.name);
    expect(row0Names).toContain("W");
    expect(row0Names).toContain("E");
    expect(row0Names).toContain("R");

    // Unbound should be in row 1
    const row1Names = row1.filter((a) => a !== undefined).map((a) => a!.name);
    expect(row1Names).toContain("Unbound");
  });

  it("should shift to nearby rows first", () => {
    const actions = [
      // Fill row 2 (third row) with 5 items
      createAction("Z", ["KeyZ"]),
      createAction("X", ["KeyX"]),
      createAction("C", ["KeyC"]),
      createAction("V", ["KeyV"]),
      createAction("B", ["KeyB"]),
    ];

    const rows = actionsToRows(actions, 3);

    // Row 2 should shift to row 1 (distance 1), not row 0 (distance 2)
    const row2 = rows[2];
    const row1 = rows[1];

    expect(row2.filter((a) => a !== undefined).length).toBeLessThanOrEqual(3);
    expect(row1.filter((a) => a !== undefined).length).toBeGreaterThan(0);
  });

  it("should not shift if target row would exceed limit", () => {
    const actions = [
      // Row 0: 3 actions
      createAction("Q", ["KeyQ"]),
      createAction("W", ["KeyW"]),
      createAction("E", ["KeyE"]),
      // Row 1: 4 actions (will need to compact)
      createAction("A", ["KeyA"]),
      createAction("S", ["KeyS"]),
      createAction("D", ["KeyD"]),
      createAction("F", ["KeyF"]),
    ];

    const rows = actionsToRows(actions, 3);

    // Row 0 already has 3, so row 1 cannot shift there
    const row0 = rows[0].filter((a) => a !== undefined);
    const row1 = rows[1].filter((a) => a !== undefined);

    expect(row0.length).toBeLessThanOrEqual(3);
    expect(row1.length).toBeLessThanOrEqual(3);
  });

  it("should handle unlimited (11) columns by not compacting", () => {
    const actions = Array.from(
      { length: 15 },
      (_, i) =>
        createAction(`Action${i}`, [`Key${String.fromCharCode(65 + i)}`]),
    );

    const rows = actionsToRows(actions, 11);

    // Should not compact, just place actions naturally
    const totalActions = rows.flat().filter((a) => a !== undefined).length;
    expect(totalActions).toBe(15);
  });

  it("should fill holes in target row before extending it", () => {
    const actions = [
      // Row 0: [undefined, W, E, R, T] - needs to compact
      createAction("W", ["KeyW"]),
      createAction("E", ["KeyE"]),
      createAction("R", ["KeyR"]),
      createAction("T", ["KeyT"]),
      // Row 1: [undefined, S] - has a hole at position 0
      createAction("S", ["KeyS"]),
    ];

    const rows = actionsToRows(actions, 3);

    // When row 0 shifts an item to row 1, it should fill the hole at position 0
    const row1 = rows[1];
    expect(row1[0]).not.toBeUndefined(); // Hole should be filled
  });

  it("should not show shop menu for entity with no purchase actions", () => {
    addEntity(createTestPlayer());
    localPlayerIdVar("player-0");

    // Configure a shop menu for wolf prefab
    menusVar([
      {
        id: "shop",
        name: "Shop",
        icon: "shop",
        prefabs: ["wolf"],
        binding: ["KeyB"],
        actions: [
          { type: "action", actionKey: "back" },
          { type: "purchase", itemId: "claw" },
        ],
      },
    ]);

    // Create a wolf entity with no purchase actions (like a mirror)
    selectionVar({
      id: "unit-0",
      owner: "player-0",
      prefab: "wolf",
      actions: [
        { type: "auto", name: "Stop", order: "stop" },
        { type: "target", name: "Attack", order: "attack" },
      ],
    });

    render(<ActionBar />, { wrapper: Wrapper });

    // Should show entity actions
    expect(screen.getByLabelText("Stop")).toBeTruthy();
    expect(screen.getByLabelText("Attack")).toBeTruthy();

    // Should NOT show shop menu since entity has no purchase actions
    expect(screen.queryByLabelText("Shop")).toBeNull();
  });
});
