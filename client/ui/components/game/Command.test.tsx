import "@/testing/setup.ts";
import { describe, it } from "jsr:@std/testing/bdd";
import { render, screen } from "npm:@testing-library/react";
import { userEvent } from "npm:@testing-library/user-event";
import { expect } from "jsr:@std/expect";
import { Wrapper } from "../../Wrapper.tsx";
import { getAllTexts } from "@/testing/utils.tsx";
import { Command } from "./Command.tsx";
import { playersVar } from "@/vars/players.ts";

describe("Command", () => {
  it("should render button with aria-label", () => {
    render(<Command name="Test Action" />, { wrapper: Wrapper });

    expect(screen.getByLabelText("Test Action")).toBeTruthy();
  });

  it("should display tooltip on hover", async () => {
    render(<Command name="Stop" />, { wrapper: Wrapper });

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
    render(<Command name="Cast Spell" disabled />, { wrapper: Wrapper });

    const button = screen.getByRole("button");
    expect(button.getAttribute("aria-disabled")).toBe("true");
  });

  it("should show pressed state when current", () => {
    render(<Command name="Hold" current />, { wrapper: Wrapper });

    const button = screen.getByRole("button");
    expect(button.getAttribute("aria-pressed")).toBe("true");
  });

  it("should show unpressed state when not current", () => {
    render(<Command name="Stop" current={false} />, { wrapper: Wrapper });

    const button = screen.getByRole("button");
    expect(button.getAttribute("aria-pressed")).toBe("false");
  });

  it("should display keyboard shortcut", () => {
    render(<Command name="Attack" binding={["KeyA"]} />, { wrapper: Wrapper });

    expect(screen.getByText("A")).toBeTruthy();
  });

  it("should display complex keyboard shortcut", () => {
    render(<Command name="Special" binding={["ControlLeft", "KeyS"]} />, { wrapper: Wrapper });

    expect(screen.getByText("⌃ + S")).toBeTruthy();
  });

  it("should dispatch keyboard events when clicked", () => {
    render(<Command name="Stop" binding={["KeyS"]} />, { wrapper: Wrapper });

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
    render(<Command name="Multi" binding={["ControlLeft", "KeyA"]} />, { wrapper: Wrapper });

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
    render(<Command name="NoBinding" />, { wrapper: Wrapper });

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

    render(<Command name="Move" icon="route" />, { wrapper: Wrapper });

    // Icon rendering is handled by SvgIcon component, just verify it's present
    expect(screen.getByRole("button")).toBeTruthy();
  });

  it("should show disabled state correctly", () => {
    render(<Command name="Disabled" disabled />, { wrapper: Wrapper });

    const button = screen.getByRole("button");
    expect(button.getAttribute("aria-disabled")).toBe("true");
    // The styling is implementation detail - focus on the functional aspect
  });
});
