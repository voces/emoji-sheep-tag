import "@/client-testing/setup.ts";
import { beforeEach, describe, it } from "@std/testing/bdd";
import { expect } from "@std/expect";
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { Lobby } from "./index.tsx";
import { lobbySettingsVar } from "@/vars/lobbySettings.ts";
import { TestWrapper } from "@/client-testing/utils.tsx";
import { addEntity } from "@/shared/api/entity.ts";
import { createTestPlayer } from "@/client-testing/test-helpers.ts";
import { localPlayerIdVar } from "@/vars/localPlayerId.ts";

describe("Lobby Settings UI", () => {
  beforeEach(() => {
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

  const openHostControls = async () => {
    const toggle = screen.getByText("Host controls");
    await userEvent.click(toggle);
  };

  it("should display lobby settings to all players", async () => {
    addEntity(createTestPlayer({ id: "player-1" }));
    localPlayerIdVar("player-1");

    const { getByDisplayValue } = render(<Lobby />, {
      wrapper: TestWrapper,
    });

    await openHostControls();

    expect(getByDisplayValue("100")).toBeTruthy();
    expect(getByDisplayValue("150")).toBeTruthy();
  });

  it("should enable inputs for host player", async () => {
    addEntity(createTestPlayer());
    localPlayerIdVar("player-0");

    render(<Lobby />, { wrapper: TestWrapper });
    await openHostControls();

    const sheepInput = screen.getByLabelText("Start gold · Sheep");
    const wolvesInput = screen.getByLabelText("Start gold · Wolf");

    expect(sheepInput).toBeTruthy();
    expect(wolvesInput).toBeTruthy();
    expect((sheepInput as HTMLInputElement).disabled).toBe(false);
    expect((wolvesInput as HTMLInputElement).disabled).toBe(false);
  });

  it("should disable inputs for non-host players", async () => {
    addEntity(createTestPlayer({ id: "player-1" }));
    localPlayerIdVar("player-1");

    render(<Lobby />, { wrapper: TestWrapper });
    await openHostControls();

    const sheepInput = screen.getByLabelText("Start gold · Sheep");
    const wolvesInput = screen.getByLabelText("Start gold · Wolf");

    expect(sheepInput).toBeTruthy();
    expect(wolvesInput).toBeTruthy();
    expect((sheepInput as HTMLInputElement).disabled).toBe(true);
    expect((wolvesInput as HTMLInputElement).disabled).toBe(true);
  });

  it("should copy a share link with the lobby name as a query param", async () => {
    addEntity(createTestPlayer({ id: "player-1" }));
    localPlayerIdVar("player-1");
    lobbySettingsVar({ ...lobbySettingsVar(), name: "alpha" });

    let copied = "";
    Object.defineProperty(globalThis.navigator, "clipboard", {
      value: { writeText: (t: string) => Promise.resolve(void (copied = t)) },
      configurable: true,
    });

    render(<Lobby />, { wrapper: TestWrapper });

    const button = await screen.findByRole("button", {
      name: /copy invite link/i,
    });
    await userEvent.click(button);

    expect(copied).toContain("lobby=alpha");
    await screen.findByRole("button", { name: /link copied/i });
  });

  it("should update display when lobby settings change", async () => {
    addEntity(createTestPlayer());
    localPlayerIdVar("player-0");

    const { container, rerender } = render(<Lobby />, {
      wrapper: TestWrapper,
    });
    await openHostControls();

    expect(container.querySelector('input[value="100"]')).toBeTruthy();
    expect(container.querySelector('input[value="150"]')).toBeTruthy();

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

    expect(container.querySelector('input[value="500"]')).toBeTruthy();
    expect(container.querySelector('input[value="750"]')).toBeTruthy();
  });
});
