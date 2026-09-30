import "@/client-testing/setup.ts";
import { it } from "@std/testing/bdd";
import { expect } from "@std/expect";
import { act, renderHook } from "@testing-library/react";
import { app, type Entity, map } from "../../ecs.ts";
import { lobbySettingsVar } from "@/vars/lobbySettings.ts";
import { useEffectiveGold } from "./useEffectiveGold.ts";

const waitForFlush = () =>
  act(() => new Promise((resolve) => setTimeout(resolve, 150)));

it("combines sheep and team gold and follows whole-gold team changes", async () => {
  lobbySettingsVar({ ...lobbySettingsVar(), mode: "survival", teamGold: true });
  app.addEntity({ id: "player-0", isPlayer: true, team: "sheep", gold: 3 });
  const team: Entity = app.addEntity({ id: "team-sheep", gold: 10 });
  map[team.id] = team;

  let renders = 0;
  const { result } = renderHook(() => {
    renders++;
    return useEffectiveGold("player-0");
  });
  expect(result.current).toBe(13);
  await waitForFlush();
  renders = 0;

  act(() => {
    team.gold = 10.5;
  });
  expect(renders).toBe(0);

  act(() => {
    team.gold = 12;
  });
  await waitForFlush();
  expect(result.current).toBe(15);
  expect(renders).toBe(1);
});
