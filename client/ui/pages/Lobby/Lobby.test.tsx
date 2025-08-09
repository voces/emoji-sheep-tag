import "@/testing/setup.ts";
import { afterEach, beforeEach, describe, it } from "jsr:@std/testing/bdd";
import { expect } from "jsr:@std/expect";
import { render } from "npm:@testing-library/react";
import { Lobby } from "./index.tsx";
import { playersVar } from "@/vars/players.ts";
import { lobbySettingsVar } from "@/vars/lobbySettings.ts";
import { TestWrapper } from "@/testing/utils.tsx";

// We'll test the UI behavior, not the actual network sending
// The send function calls are handled by the parent component/client

describe("Lobby Settings UI", () => {
  beforeEach(() => {
    // Set up initial lobby settings
    lobbySettingsVar({
      startingGold: { sheep: 100, wolves: 150 },
    });
  });

  afterEach(() => {
    // Clean up players state
    playersVar([]);
    lobbySettingsVar({
      startingGold: { sheep: 0, wolves: 0 },
    });
  });

  it("should display lobby settings to all players", () => {
    // Set up non-host player
    playersVar([
      {
        id: "player1",
        name: "Player 1",
        color: "#ff0000",
        local: true,
        host: false,
        sheepCount: 0,
      },
    ]);

    const { getByDisplayValue, getByText } = render(<Lobby />, { wrapper: TestWrapper });

    // Settings should be visible
    expect(getByText("Game Settings")).toBeTruthy();
    expect(getByText("Starting Gold - Sheep")).toBeTruthy();
    expect(getByText("Starting Gold - Wolves")).toBeTruthy();

    // Values should be displayed
    expect(getByDisplayValue("100")).toBeTruthy();
    expect(getByDisplayValue("150")).toBeTruthy();
  });

  it("should enable inputs for host player", () => {
    // Set up host player
    playersVar([
      {
        id: "host",
        name: "Host Player",
        color: "#00ff00",
        local: true,
        host: true,
        sheepCount: 0,
      },
    ]);

    const { container } = render(<Lobby />, { wrapper: TestWrapper });

    const sheepInput = container.querySelector(
      'input[value="100"]',
    ) as HTMLInputElement;
    const wolvesInput = container.querySelector(
      'input[value="150"]',
    ) as HTMLInputElement;

    expect(sheepInput).toBeTruthy();
    expect(wolvesInput).toBeTruthy();
    expect(sheepInput.disabled).toBe(false);
    expect(wolvesInput.disabled).toBe(false);
  });

  it("should disable inputs for non-host players", () => {
    // Set up non-host player
    playersVar([
      {
        id: "player1",
        name: "Player 1",
        color: "#ff0000",
        local: true,
        host: false,
        sheepCount: 0,
      },
    ]);

    const { container } = render(<Lobby />, { wrapper: TestWrapper });

    const sheepInput = container.querySelector(
      'input[value="100"]',
    ) as HTMLInputElement;
    const wolvesInput = container.querySelector(
      'input[value="150"]',
    ) as HTMLInputElement;

    expect(sheepInput).toBeTruthy();
    expect(wolvesInput).toBeTruthy();
    expect(sheepInput.disabled).toBe(true);
    expect(wolvesInput.disabled).toBe(true);
  });


  it("should allow host to interact with inputs", () => {
    // Set up host player
    playersVar([
      {
        id: "host",
        name: "Host Player",
        color: "#00ff00",
        local: true,
        host: true,
        sheepCount: 0,
      },
    ]);

    const { container } = render(<Lobby />, { wrapper: TestWrapper });

    const sheepInput = container.querySelector(
      'input[value="100"]',
    ) as HTMLInputElement;
    const wolvesInput = container.querySelector(
      'input[value="150"]',
    ) as HTMLInputElement;

    // Host should be able to interact with inputs
    expect(sheepInput).toBeTruthy();
    expect(wolvesInput).toBeTruthy();
    expect(sheepInput.disabled).toBe(false);
    expect(wolvesInput.disabled).toBe(false);

    // Should have normal styling for enabled inputs
    expect(sheepInput.style.backgroundColor).toBe("");
    expect(sheepInput.style.color).toBe("");
    expect(sheepInput.style.cursor).toBe("");
  });

  it("should prevent non-host from interacting with inputs", () => {
    // Set up non-host player
    playersVar([
      {
        id: "player1",
        name: "Player 1",
        color: "#ff0000",
        local: true,
        host: false,
        sheepCount: 0,
      },
    ]);

    const { container } = render(<Lobby />, { wrapper: TestWrapper });

    const sheepInput = container.querySelector(
      'input[value="100"]',
    ) as HTMLInputElement;

    // Input should be disabled for non-host
    expect(sheepInput.disabled).toBe(true);
  });

  it("should update display when lobby settings change", () => {
    // Set up host player
    playersVar([
      {
        id: "host",
        name: "Host Player",
        color: "#00ff00",
        local: true,
        host: true,
        sheepCount: 0,
      },
    ]);

    const { container, rerender } = render(<Lobby />, { wrapper: TestWrapper });

    // Verify initial values
    expect(container.querySelector('input[value="100"]')).toBeTruthy();
    expect(container.querySelector('input[value="150"]')).toBeTruthy();

    // Update lobby settings (simulating server message)
    lobbySettingsVar({
      startingGold: { sheep: 500, wolves: 750 },
    });

    rerender(<Lobby />);

    // Should display new values
    expect(container.querySelector('input[value="500"]')).toBeTruthy();
    expect(container.querySelector('input[value="750"]')).toBeTruthy();
  });
});
