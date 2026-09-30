import "@/client-testing/setup.ts";
import { it } from "@std/testing/bdd";
import { expect } from "@std/expect";
import { act, renderHook } from "@testing-library/react";
import { app, type Entity } from "../../ecs.ts";
import { usePlayers } from "./usePlayers.ts";

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
