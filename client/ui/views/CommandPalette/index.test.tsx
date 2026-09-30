import "@/client-testing/setup.ts";
import { it } from "@std/testing/bdd";
import { expect } from "@std/expect";
import { act, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { Wrapper } from "../../Wrapper.tsx";
import { CommandPalette } from "./index.tsx";
import { showCommandPaletteVar } from "@/vars/showCommandPalette.ts";
import { uiSettingsVar } from "@/vars/uiSettings.ts";
import { ignoredPlayersVar } from "@/vars/ignoredPlayers.ts";
import { showSettingsVar } from "@/vars/showSettings.ts";
import { app } from "../../../ecs.ts";

// jsdom does not implement scrolling
Element.prototype.scrollIntoView ??= () => {};

it("refreshes command labels when their source changes while open", async () => {
  uiSettingsVar({ ...uiSettingsVar(), showPing: false });
  render(<CommandPalette />, { wrapper: Wrapper });
  act(() => {
    showCommandPaletteVar("open");
  });
  expect(await screen.findByText("Show ping")).toBeTruthy();

  act(() => {
    uiSettingsVar({ ...uiSettingsVar(), showPing: true });
  });

  expect(await screen.findByText("Hide ping")).toBeTruthy();
  expect(screen.queryByText("Show ping")).toBeNull();
});

it("runs the focused command on enter and closes", async () => {
  uiSettingsVar({ ...uiSettingsVar(), showPing: false });
  render(<CommandPalette />, { wrapper: Wrapper });
  act(() => {
    showCommandPaletteVar("open");
  });

  await userEvent.type(
    await screen.findByPlaceholderText("Search actions, settings, pages…"),
    "show ping{Enter}",
  );

  expect(uiSettingsVar().showPing).toBe(true);
  expect(showCommandPaletteVar()).toBe("closed");
});

it("runs a command once when it changes a command source without renaming itself", async () => {
  let runs = 0;
  const unsubscribe = showSettingsVar.subscribe((open) => {
    if (!open) return;
    runs++;
    uiSettingsVar({ ...uiSettingsVar(), showFps: !uiSettingsVar().showFps });
    showSettingsVar(false);
  });
  try {
    render(<CommandPalette />, { wrapper: Wrapper });
    act(() => {
      showCommandPaletteVar("open");
    });

    await userEvent.type(
      await screen.findByPlaceholderText("Search actions, settings, pages…"),
      "open settings{Enter}",
    );

    expect(runs).toBe(1);
    expect(showCommandPaletteVar()).toBe("closed");
  } finally {
    unsubscribe();
  }
});

it("opens nested options and runs the chosen one", async () => {
  app.addEntity({
    id: "player-1",
    isPlayer: true,
    clientId: "client-1",
    name: "Bob",
  });
  render(<CommandPalette />, { wrapper: Wrapper });
  act(() => {
    showCommandPaletteVar("open");
  });
  const input = await screen.findByPlaceholderText(
    "Search actions, settings, pages…",
  );

  await userEvent.type(input, "ignore player{Enter}");
  expect(await screen.findByText("Ignore Bob")).toBeTruthy();
  expect(showCommandPaletteVar()).toBe("open");

  await userEvent.type(input, "{Enter}");
  expect(ignoredPlayersVar()).toEqual(["client-1"]);
  expect(showCommandPaletteVar()).toBe("closed");
});
