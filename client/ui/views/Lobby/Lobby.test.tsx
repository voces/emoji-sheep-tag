import "@/client-testing/setup.ts";
import { beforeEach, describe, it } from "@std/testing/bdd";
import { expect } from "@std/expect";
import { render, screen } from "@testing-library/react";
import { Lobby } from "./index.tsx";
import { lobbySettingsVar } from "@/vars/lobbySettings.ts";
import { TestWrapper } from "@/client-testing/utils.tsx";
import { addEntity } from "@/shared/api/entity.ts";
import { createTestPlayer } from "@/client-testing/test-helpers.ts";
import { localPlayerIdVar } from "@/vars/localPlayerId.ts";

// We'll test the UI behavior, not the actual network sending
// The send function calls are handled by the parent component/client

describe("Lobby Settings UI", () => {
  beforeEach(() => {
    // Set up initial lobby settings
    lobbySettingsVar({
      map: "revo",
      mode: "survival",
      vipHandicap: 0.8,
      sheep: 2,
      autoSheep: false,
      time: 300,
      autoTime: false,
      startingGold: { sheep: 100, wolves: 150 },
      income: { sheep: 1, wolves: 1 },
      view: false,
      teamGold: true,
      host: "player-0",
      shard: null,
      shards: [],
    });
  });

  it("should display lobby settings to all players", () => {
    // Set up non-host player
    addEntity(createTestPlayer({ id: "player-1" }));
    localPlayerIdVar("player-1");

    const { getByDisplayValue, getByText } = render(<Lobby />, {
      wrapper: TestWrapper,
    });

    // Settings should be visible
    expect(getByText("Game Settings")).toBeTruthy();
    expect(getByText("Starting Gold - Sheep")).toBeTruthy();
    expect(getByText("Starting Gold - Wolves")).toBeTruthy();

    // Values should be displayed
    expect(getByDisplayValue("100")).toBeTruthy();
    expect(getByDisplayValue("150")).toBeTruthy();
  });

  it("should enable inputs for host player", () => {
    addEntity(createTestPlayer());
    localPlayerIdVar("player-0");

    render(<Lobby />, { wrapper: TestWrapper });

    const sheepInput = screen.getByLabelText("Starting Gold - Sheep");
    const wolvesInput = screen.getByLabelText("Starting Gold - Wolves");

    expect(sheepInput).toBeTruthy();
    expect(wolvesInput).toBeTruthy();
    expect((sheepInput as HTMLInputElement).disabled).toBe(false);
    expect((wolvesInput as HTMLInputElement).disabled).toBe(false);
  });

  it("should disable inputs for non-host players", () => {
    // Set up non-host player
    addEntity(createTestPlayer({ id: "player-1" }));
    localPlayerIdVar("player-1");

    render(<Lobby />, { wrapper: TestWrapper });

    const sheepInput = screen.getByLabelText("Starting Gold - Sheep");
    const wolvesInput = screen.getByLabelText("Starting Gold - Wolves");

    expect(sheepInput).toBeTruthy();
    expect(wolvesInput).toBeTruthy();
    expect((sheepInput as HTMLInputElement).disabled).toBe(true);
    expect((wolvesInput as HTMLInputElement).disabled).toBe(true);
  });

  it("should update display when lobby settings change", () => {
    // Set up host player
    addEntity(createTestPlayer());
    localPlayerIdVar("player-0");

    const { container, rerender } = render(<Lobby />, { wrapper: TestWrapper });

    // Verify initial values
    expect(container.querySelector('input[value="100"]')).toBeTruthy();
    expect(container.querySelector('input[value="150"]')).toBeTruthy();

    // Update lobby settings (simulating server message)
    lobbySettingsVar({
      map: "revo",
      mode: "survival",
      vipHandicap: 0.8,
      sheep: 2,
      autoSheep: false,
      time: 300,
      autoTime: false,
      startingGold: { sheep: 500, wolves: 750 },
      income: { sheep: 1, wolves: 1 },
      view: false,
      teamGold: true,
      host: "player-0",
      shard: null,
      shards: [],
    });

    rerender(<Lobby />);

    // Should display new values
    expect(container.querySelector('input[value="500"]')).toBeTruthy();
    expect(container.querySelector('input[value="750"]')).toBeTruthy();
  });
});
