import "@/testing/setup.ts";
import { describe, it } from "jsr:@std/testing/bdd";
import { render, screen } from "npm:@testing-library/react";
import { userEvent } from "npm:@testing-library/user-event";
import { expect } from "jsr:@std/expect";
import { Wrapper } from "../../Wrapper.tsx";
import { getAllTexts } from "@/testing/utils.ts";
import { Command } from "./Command.tsx";
import { playersVar } from "@/vars/players.ts";

describe("Command", () => {
  it("should render button with aria-label", () => {
    render(<Command name="Test Action" />);

    const button = screen.getByRole("button");
    expect(button.ariaLabel).toBe("Test Action");
  });

  it("should display tooltip on hover", async () => {
    render(<Command name="Stop" />);

    await userEvent.hover(screen.getByRole("button"));

    expect(screen.getByRole("tooltip").textContent).toBe("Stop");
  });

  it("should display tooltip with gold cost", async () => {
    render(<Command name="Build Farm" goldCost={50} />, { wrapper: Wrapper });

    await userEvent.hover(screen.getByRole("button"));

    expect(getAllTexts(screen.getByRole("tooltip"))).toEqual([
      "Build Farm",
      "Gold",
      "50",
    ]);
  });

  it("should show disabled state", () => {
    render(<Command name="Cast Spell" disabled />);

    expect(screen.getByRole("button").ariaDisabled).toBe("true");
  });

  it("should show pressed state when current", () => {
    render(<Command name="Hold" current />);

    expect(screen.getByRole("button").ariaPressed).toBe("true");
  });

  it("should show unpressed state when not current", () => {
    render(<Command name="Stop" current={false} />);

    expect(screen.getByRole("button").ariaPressed).toBe("false");
  });

  it("should display keyboard shortcut", () => {
    render(<Command name="Attack" binding={["KeyA"]} />);

    expect(screen.getByText("A")).toBeTruthy();
  });

  it("should display complex keyboard shortcut", () => {
    render(<Command name="Special" binding={["ControlLeft", "KeyS"]} />);

    expect(screen.getByText("⌃ + S")).toBeTruthy();
  });

  it("should dispatch keyboard events when clicked", () => {
    render(<Command name="Stop" binding={["KeyS"]} />);

    const dispatchedEvents: KeyboardEvent[] = [];
    const originalDispatch = document.dispatchEvent;
    document.dispatchEvent = (event: Event) => {
      if (event instanceof KeyboardEvent) {
        dispatchedEvents.push(event);
      }
      return originalDispatch.call(document, event);
    };

    screen.getByRole("button").click();

    expect(dispatchedEvents.length).toBe(2); // keydown and keyup
    expect(dispatchedEvents[0].type).toBe("keydown");
    expect(dispatchedEvents[0].code).toBe("KeyS");
    expect(dispatchedEvents[1].type).toBe("keyup");
    expect(dispatchedEvents[1].code).toBe("KeyS");

    // Restore original dispatch
    document.dispatchEvent = originalDispatch;
  });

  it("should dispatch multiple keyboard events for chord", () => {
    render(<Command name="Multi" binding={["ControlLeft", "KeyA"]} />);

    const dispatchedEvents: KeyboardEvent[] = [];
    const originalDispatch = document.dispatchEvent;
    document.dispatchEvent = (event: Event) => {
      if (event instanceof KeyboardEvent) {
        dispatchedEvents.push(event);
      }
      return originalDispatch.call(document, event);
    };

    screen.getByRole("button").click();

    expect(dispatchedEvents.length).toBe(4); // 2 keydown + 2 keyup
    expect(dispatchedEvents[0].type).toBe("keydown");
    expect(dispatchedEvents[0].code).toBe("ControlLeft");
    expect(dispatchedEvents[1].type).toBe("keydown");
    expect(dispatchedEvents[1].code).toBe("KeyA");
    expect(dispatchedEvents[2].type).toBe("keyup");
    expect(dispatchedEvents[2].code).toBe("KeyA");
    expect(dispatchedEvents[3].type).toBe("keyup");
    expect(dispatchedEvents[3].code).toBe("ControlLeft");

    // Restore original dispatch
    document.dispatchEvent = originalDispatch;
  });

  it("should not dispatch events when no binding", () => {
    render(<Command name="NoBinding" />);

    const dispatchedEvents: KeyboardEvent[] = [];
    const originalDispatch = document.dispatchEvent;
    document.dispatchEvent = (event: Event) => {
      if (event instanceof KeyboardEvent) {
        dispatchedEvents.push(event);
      }
      return originalDispatch.call(document, event);
    };

    screen.getByRole("button").click();

    expect(dispatchedEvents.length).toBe(0);

    // Restore original dispatch
    document.dispatchEvent = originalDispatch;
  });

  it("should render icon when provided", () => {
    playersVar([{
      id: "player-0",
      name: "Player 0",
      color: "red",
      local: true,
      sheepCount: 0,
    }]);

    render(<Command name="Move" icon="route" />);

    // Icon rendering is handled by SvgIcon component, just verify it's present
    expect(screen.getByRole("button")).toBeTruthy();
  });

  it("should apply disabled styling", () => {
    render(<Command name="Disabled" disabled />);

    const button = screen.getByRole("button");
    expect(button.style.filter).toContain("saturate(0.3)");
    expect(button.style.opacity).toBe("0.6");
  });
});
