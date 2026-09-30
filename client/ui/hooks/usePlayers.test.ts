import "@/client-testing/setup.ts";
import { it } from "@std/testing/bdd";
import { expect } from "@std/expect";
import { act, renderHook } from "@testing-library/react";
import { app, type Entity } from "../../ecs.ts";
import { usePlayers } from "./usePlayers.ts";
import { usePlayerStats } from "../views/Lobby/usePlayerStats.ts";
import type { Round } from "@/shared/round.ts";

const waitForFlush = () =>
  act(() => new Promise((resolve) => setTimeout(resolve, 150)));

it("excludes synthetic players and keeps a stable array between renders", () => {
  app.addEntity({ id: "player-0", isPlayer: true });
  app.addEntity({ id: "practice-enemy", isPlayer: true });

  const { result, rerender } = renderHook(() => usePlayers());
  const first = result.current;
  expect(first.map((p) => p.id)).toEqual(["player-0"]);

  rerender();
  expect(result.current).toBe(first);
});

it("rerenders when a listed player prop changes", async () => {
  const player: Entity = app.addEntity({
    id: "player-0",
    isPlayer: true,
    team: "sheep",
  });
  let renders = 0;
  renderHook(() => {
    renders++;
    return usePlayers(["team"]);
  });
  await waitForFlush();
  renders = 0;

  act(() => {
    player.name = "renamed";
  });
  expect(renders).toBe(0);

  act(() => {
    player.team = "wolf";
  });
  expect(renders).toBe(1);
});

it("returns a new array when a listed player prop changes so memoised stats refresh", async () => {
  app.addEntity({ id: "player-0", isPlayer: true, team: "sheep" });
  const switcher: Entity = app.addEntity({
    id: "player-1",
    isPlayer: true,
    team: "sheep",
  });
  const rounds: Round[] = [
    {
      sheep: ["player-0", "player-1"],
      wolves: [],
      duration: 100,
      mode: "survival",
    },
    {
      sheep: ["player-0"],
      wolves: ["player-1"],
      duration: 50,
      mode: "survival",
    },
  ];

  const { result } = renderHook(() =>
    usePlayerStats(usePlayers(["team"]), rounds)
  );
  await waitForFlush();
  expect([...result.current.longestRoundIds]).toEqual(["player-0", "player-1"]);

  act(() => {
    switcher.team = "wolf";
  });
  await waitForFlush();

  expect([...result.current.longestRoundIds]).toEqual(["player-0"]);
});
