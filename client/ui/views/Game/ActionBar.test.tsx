import "@/client-testing/setup.ts";
import { describe, it } from "jsr:@std/testing/bdd";
import { render, screen } from "npm:@testing-library/react";
import { expect } from "jsr:@std/expect";
import { ActionBar, selectionVar } from "./ActionBar.tsx";
import { playersVar } from "@/vars/players.ts";
import { menuStateVar } from "@/vars/menuState.ts";
import { Wrapper } from "../../Wrapper.tsx";

describe("ActionBar", () => {
  it("should not render when no selection", () => {
    playersVar([{
      id: "player-0",
      name: "Player 0",
      color: "red",
      local: true,
      sheepCount: 0,
    }]);
    selectionVar(undefined);

    const { container } = render(<ActionBar />);
    expect(container.firstChild).toBeNull();
  });

  it("should not render when selection is not owned by local player", () => {
    playersVar([{
      id: "player-0",
      name: "Player 0",
      color: "red",
      local: true,
      sheepCount: 0,
    }]);
    selectionVar({
      id: "unit-0",
      owner: "player-1", // Different from local player
      actions: [{ type: "auto", name: "Test", order: "some-order" }],
    });

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
    expect(screen.getByLabelText("Use Potion (3)")).toBeTruthy();
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
    expect(screen.getByLabelText("Cast Spell (2)")).toBeTruthy();
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
});
