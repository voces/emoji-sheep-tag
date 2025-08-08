import "@/testing/setup.ts";
import { describe, it } from "jsr:@std/testing/bdd";
import { render, screen } from "npm:@testing-library/react";
import { expect } from "jsr:@std/expect";
import { Wrapper } from "../../Wrapper.tsx";
import { getAllTexts } from "@/testing/utils.ts";
import { Action } from "./Action.tsx";
import { playersVar } from "@/vars/players.ts";
import { userEvent } from "npm:@testing-library/user-event";

describe("Action", () => {
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
    );

    expect(screen.getByRole("button").ariaLabel).toBe("Stop");
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
    );

    expect(screen.getByRole("button").ariaLabel).toBe("Attack");
  });

  it("should render build action with gold cost", async () => {
    playersVar([{
      id: "player-0",
      name: "Player 0",
      color: "red",
      local: true,
      sheepCount: 0,
      entity: { id: "player-entity", gold: 100 },
    }]);

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

    await userEvent.hover(screen.getByRole("button"));

    expect(getAllTexts(screen.getByRole("tooltip"))).toEqual([
      "Build Farm",
      "Gold",
      "50",
    ]);
  });

  it("should render purchase action with gold cost", async () => {
    playersVar([{
      id: "player-0",
      name: "Player 0",
      color: "red",
      local: true,
      sheepCount: 0,
      entity: { id: "player-entity", gold: 200 },
    }]);

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

    await userEvent.hover(screen.getByRole("button"));

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
    );

    expect(screen.getByRole("button").ariaLabel).toBe("Shop");
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
    );

    expect(screen.getByRole("button").ariaDisabled).toBe("true");
  });

  it("should disable build action when insufficient gold", () => {
    playersVar([{
      id: "player-0",
      name: "Player 0",
      color: "red",
      local: true,
      sheepCount: 0,
      entity: { id: "player-entity", gold: 10 },
    }]);

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
    );

    expect(screen.getByRole("button").ariaDisabled).toBe("true");
  });

  it("should disable purchase action when insufficient gold", () => {
    playersVar([{
      id: "player-0",
      name: "Player 0",
      color: "red",
      local: true,
      sheepCount: 0,
      entity: { id: "player-entity", gold: 50 },
    }]);

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
    );

    expect(screen.getByRole("button").ariaDisabled).toBe("true");
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
    );

    expect(screen.getByRole("button").ariaPressed).toBe("true");
  });

  it("should enable action with sufficient resources", () => {
    playersVar([{
      id: "player-0",
      name: "Player 0",
      color: "red",
      local: true,
      sheepCount: 0,
      entity: { id: "player-entity", gold: 100 },
    }]);

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
    );

    expect(screen.getByRole("button").ariaDisabled).toBe("false");
  });
});
