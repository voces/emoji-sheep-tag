import "@/client-testing/setup.ts";
import { it } from "@std/testing/bdd";
import { render, screen } from "@testing-library/react";
import { expect } from "@std/expect";
import { Wrapper } from "../../Wrapper.tsx";
import { getAllTexts } from "@/client-testing/utils.tsx";
import { Action } from "./Action.tsx";
import { userEvent } from "@testing-library/user-event";
import { addEntity } from "@/shared/api/entity.ts";

it("should render auto action", () => {
  const entity = {
    id: "unit-0",
    owner: "player-0",
  };

  render(
    <Action
      action={{ type: "auto", name: "Stop", order: "stop" }}
      current={false}
      entity={entity}
    />,
    { wrapper: Wrapper },
  );

  expect(screen.getByLabelText("Stop")).toBeTruthy();
});

it("should render target action", () => {
  const entity = {
    id: "unit-0",
    owner: "player-0",
  };

  render(
    <Action
      action={{ type: "target", name: "Attack", order: "attack" }}
      current={false}
      entity={entity}
    />,
    { wrapper: Wrapper },
  );

  expect(screen.getByLabelText("Attack")).toBeTruthy();
});

it("should render build action with gold cost", async () => {
  addEntity({
    id: "player-0",
    name: "Player 0",
    playerColor: "red",
    sheepCount: 0,
    gold: 100,
  });

  const entity = {
    id: "unit-0",
    owner: "player-0",
  };

  render(
    <Action
      action={{
        type: "build",
        name: "Build Farm",
        unitType: "farm",
        goldCost: 50,
      }}
      current={false}
      entity={entity}
    />,
    { wrapper: Wrapper },
  );

  await userEvent.hover(screen.getByLabelText("Build Farm"));

  expect(getAllTexts(screen.getByRole("tooltip"))).toEqual([
    "Build Farm",
    "Gold",
    "50",
  ]);
});

it("should render purchase action with gold cost", async () => {
  addEntity({
    id: "player-0",
    name: "Player 0",
    playerColor: "red",
    sheepCount: 0,
    gold: 200,
  });

  const entity = {
    id: "unit-0",
    owner: "player-0",
  };

  render(
    <Action
      action={{
        type: "purchase",
        name: "Buy Sword",
        itemId: "sword",
        goldCost: 100,
      }}
      current={false}
      entity={entity}
    />,
    { wrapper: Wrapper },
  );

  await userEvent.hover(screen.getByLabelText("Buy Sword"));

  expect(getAllTexts(screen.getByRole("tooltip"))).toEqual([
    "Buy Sword",
    "Gold",
    "100",
  ]);
});

it("should render menu action", () => {
  const entity = {
    id: "unit-0",
    owner: "player-0",
  };

  render(
    <Action
      action={{
        type: "menu",
        name: "Shop",
        actions: [],
      }}
      current={false}
      entity={entity}
    />,
    { wrapper: Wrapper },
  );

  expect(screen.getByLabelText("Shop")).toBeTruthy();
});

it("should disable action when insufficient mana", () => {
  const entity = {
    id: "unit-0",
    owner: "player-0",
    mana: 10,
  };

  render(
    <Action
      action={{
        type: "auto",
        name: "Cast Spell",
        order: "spell",
        manaCost: 50, // More than available mana
      }}
      current={false}
      entity={entity}
    />,
    { wrapper: Wrapper },
  );

  const element = screen.getByLabelText("Cast Spell");
  expect(element.getAttribute("aria-disabled")).toBe("true");
});

it("should disable build action when insufficient gold", () => {
  addEntity({
    id: "player-0",
    name: "Player 0",
    playerColor: "red",
    sheepCount: 0,
    gold: 10,
  });

  const entity = {
    id: "unit-0",
    owner: "player-0",
  };

  render(
    <Action
      action={{
        type: "build",
        name: "Build Farm",
        unitType: "farm",
        goldCost: 50, // More than available gold
      }}
      current={false}
      entity={entity}
    />,
    { wrapper: Wrapper },
  );

  const element = screen.getByLabelText("Build Farm");
  expect(element.getAttribute("aria-disabled")).toBe("true");
});

it("should disable purchase action when insufficient gold", () => {
  addEntity({
    id: "player-0",
    name: "Player 0",
    playerColor: "red",
    sheepCount: 0,
    gold: 50,
  });

  const entity = {
    id: "unit-0",
    owner: "player-0",
  };

  render(
    <Action
      action={{
        type: "purchase",
        name: "Buy Expensive Item",
        itemId: "expensive",
        goldCost: 100, // More than available gold
      }}
      current={false}
      entity={entity}
    />,
    { wrapper: Wrapper },
  );

  const element = screen.getByLabelText("Buy Expensive Item");
  expect(element.getAttribute("aria-disabled")).toBe("true");
});

it("should show current state when action is current", () => {
  const entity = {
    id: "unit-0",
    owner: "player-0",
  };

  render(
    <Action
      action={{ type: "auto", name: "Hold", order: "hold" }}
      current
      entity={entity}
    />,
    { wrapper: Wrapper },
  );

  const element = screen.getByLabelText("Hold");
  expect(element.getAttribute("aria-pressed")).toBe("true");
});

it("should enable action with sufficient resources", () => {
  addEntity({
    id: "player-0",
    isPlayer: true,
    name: "Player 0",
    playerColor: "red",
    sheepCount: 0,
    gold: 100,
  });

  const entity = {
    id: "unit-0",
    owner: "player-0",
    mana: 50,
  };

  render(
    <Action
      action={{
        type: "build",
        name: "Build Farm",
        unitType: "farm",
        goldCost: 50,
        manaCost: 25,
      }}
      current={false}
      entity={entity}
    />,
    { wrapper: Wrapper },
  );

  const element = screen.getByLabelText("Build Farm");
  expect(element.getAttribute("aria-disabled")).not.toBe("true");
});
