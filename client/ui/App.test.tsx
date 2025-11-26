import {
  clearTestServerMessages,
  getTestServerMessages,
  getTestServerPort,
  sendMessageFromServer,
  setCurrentTestFile,
} from "@/client-testing/integration-setup.ts";
import "@/client-testing/setup.ts";
import { it } from "@std/testing/bdd";
import { setServer } from "../client.ts";
import { render, screen, waitFor } from "@testing-library/react";
import { App } from "./App.tsx";
import { userEvent } from "@testing-library/user-event";
import { colors, practiceModeActions } from "@/shared/data.ts";
import { mergeEntityWithPrefab } from "@/shared/api/entity.ts";
import { Entity } from "@/shared/types.ts";
import { expect } from "@std/expect/expect";
setCurrentTestFile("App.test.ts");

it("can move an action into a menu", async () => {
  clearTestServerMessages();
  setServer(`localhost:${getTestServerPort()}`);
  render(<App />);
  await userEvent.click(screen.getByText("Settings"));
  await userEvent.click(screen.getByText("Shortcuts"));
  await userEvent.click(screen.getByText("Wolf"));
  await userEvent.click(screen.getByText("Edit"));
  await userEvent.click(screen.getByLabelText("Add Mirror Image"));
  await userEvent.click(screen.getByText("Save"));
  await userEvent.click(screen.getByTitle("Close settings"));
  await userEvent.click(screen.getByText("Multiplayer"));
  sendMessageFromServer({
    type: "join",
    lobby: "Strong Spirit",
    status: "lobby",
    updates: [{
      id: "player-0",
      isPlayer: true,
      name: "Player 0",
      playerColor: colors[0],
      team: "sheep",
      sheepCount: 0,
    }],
    localPlayer: "player-0",
    rounds: [],
    lobbySettings: {
      map: "revo",
      mode: "survival",
      vipHandicap: 0.75,
      sheep: 1,
      autoSheep: true,
      time: 60,
      autoTime: true,
      startingGold: { sheep: 0, wolves: 0 },
      income: { sheep: 1, wolves: 1 },
      view: false,
      host: "player-0",
    },
  });
  await userEvent.click(
    await screen.findByRole("button", { name: "Practice" }, { timeout: 5000 }),
  );
  sendMessageFromServer({
    type: "start",
    updates: [
      { id: "player-0", sheepCount: 1 },
      {
        id: "practice-enemy",
        name: "Enemy",
        isPlayer: true,
        team: "wolf",
        gold: 0,
        playerColor: "#ff0000",
      },
    ],
  });
  sendMessageFromServer({
    type: "updates",
    updates: [
      {
        ...mergeEntityWithPrefab({ prefab: "wolf", owner: "player-0" }),
        trueOwner: "player-0",
        actions: [
          ...mergeEntityWithPrefab({ prefab: "wolf" }).actions!,
          practiceModeActions.giveToEnemy,
        ],
      } as Entity,
    ],
  });

  // Mirror Image not in top-level actions
  await waitFor(() =>
    expect(
      screen.getAllByRole("button")
        .filter((b) => b.getAttribute("aria-label"))
        .map((b) => [b.ariaLabel, b.querySelector("kbd")?.textContent]),
    ).toEqual([
      ["Wolf", undefined],
      ["Give to Enemy", "Q"],
      ["Place Sentry", "W"],
      ["Attack", "A"],
      ["Shadowstep", "D"],
      ["Hold position", "H"],
      ["Stop", "Z"],
      ["Swap", "C"],
      ["Move", "V"],
      ["Shop", "B"],
    ])
  );

  // Pressing R outside Shop does not trigger in shop actions
  await userEvent.type(document.body, "R");
  expect(getTestServerMessages().at(-1)).not.toEqual(
    expect.objectContaining({ order: "mirrorImage" }),
  );

  // Mirror Image appears in shop action
  await userEvent.click(screen.getByLabelText("Shop"));
  await waitFor(() =>
    expect(
      screen.getAllByRole("button")
        .filter((b) => b.getAttribute("aria-label"))
        .map((b) => [b.ariaLabel, b.querySelector("kbd")?.textContent]),
    ).toEqual([
      ["Wolf", undefined],
      ["Back", "`"],
      ["Purchase Bomber", "E"],
      ["Mirror Image", "R"],
      ["Purchase Locate Sheep", "T"],
      ["Purchase Scythe", "Y"],
      ["Purchase Echo Fang", "A"],
      ["Purchase Potion of Speed", "S"],
      ["Purchase Dire Collar", "D"],
      ["Purchase Fox Token", "F"],
      ["Purchase Potion of Strength", "G"],
      ["Purchase Hay Trap", "X"],
      ["Purchase Claws +20", "C"],
      ["Purchase Swift Claws +15%", "V"],
      ["Purchase Boots +30", "B"],
      ["Purchase Mana Potion", "M"],
    ])
  );
});
