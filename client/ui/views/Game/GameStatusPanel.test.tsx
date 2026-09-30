import "@/client-testing/setup.ts";
import { it } from "@std/testing/bdd";
import { expect } from "@std/expect";
import { act, render, renderHook, screen } from "@testing-library/react";
import { Wrapper } from "../../Wrapper.tsx";
import { app, type Entity } from "../../../ecs.ts";
import {
  GameStatusPanel,
  timersVar,
  useMainTimerExpiration,
} from "./GameStatusPanel.tsx";

it("updates the countdown as the timer ticks", async () => {
  app.addEntity({ id: "player-0", isPlayer: true, team: "sheep" });
  const timer: Entity = app.addEntity({
    id: "timer-0",
    isTimer: true,
    buffs: [{ remainingDuration: 30, expiration: "Time until sheep spawn:" }],
  });

  render(<GameStatusPanel />, { wrapper: Wrapper });
  expect(await screen.findByText("Time until sheep spawn:")).toBeTruthy();
  expect(screen.getByText("0:30")).toBeTruthy();

  act(() => {
    timer.buffs = [{
      remainingDuration: 12,
      expiration: "Time until sheep spawn:",
    }];
  });
  expect(await screen.findByText("0:12")).toBeTruthy();
});

it("only rerenders the panel's timer label when the label changes", () => {
  const timer: Entity = app.addEntity({
    id: "timer-0",
    isTimer: true,
    buffs: [{ remainingDuration: 30, expiration: "Time until sheep spawn:" }],
  });
  let renders = 0;
  const { result } = renderHook(() => {
    renders++;
    return useMainTimerExpiration();
  });
  expect(result.current).toBe("Time until sheep spawn:");
  renders = 0;

  act(() => {
    timer.buffs = [{
      remainingDuration: 29,
      expiration: "Time until sheep spawn:",
    }];
  });
  expect(timersVar()[0].buffs?.[0].remainingDuration).toBe(29);
  expect(renders).toBe(0);

  act(() => {
    timer.buffs = [{
      remainingDuration: 60,
      expiration: "Time until wolves spawn:",
    }];
  });
  expect(renders).toBe(1);
  expect(result.current).toBe("Time until wolves spawn:");
});
