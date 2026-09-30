import "@/client-testing/setup.ts";
import { it } from "@std/testing/bdd";
import { expect } from "@std/expect";
import { act, renderHook } from "@testing-library/react";
import { app, type Entity } from "../../ecs.ts";
import {
  useListenToEntityProp,
  useListenToEntityProps,
} from "./useListenToEntityProp.ts";

const waitForFlush = () =>
  act(() => new Promise((resolve) => setTimeout(resolve, 150)));

it("does not resubscribe or flush the throttle when an inline transform changes", async () => {
  const entity: Entity = app.addEntity({ id: "gold-holder", gold: 0 });
  let renders = 0;
  const { result, rerender } = renderHook(() => {
    renders++;
    return useListenToEntityProp(entity, "gold", (g) => Math.floor(g ?? 0));
  });
  await waitForFlush();
  renders = 0;

  act(() => {
    entity.gold = 1;
  });
  expect(result.current).toBe(1);
  expect(renders).toBe(1);

  act(() => {
    entity.gold = 2;
  });
  expect(result.current).toBe(1);

  rerender();
  expect(result.current).toBe(2);
  expect(renders).toBe(2);

  await waitForFlush();
  expect(renders).toBe(2);
});

it("throttles updates and delivers the latest value after the window", async () => {
  const entity: Entity = app.addEntity({ id: "mana-holder", mana: 0 });
  const { result } = renderHook(() =>
    useListenToEntityProps(entity, ["mana"], ({ mana }) => mana ?? 0)
  );
  await waitForFlush();

  act(() => {
    entity.mana = 1;
  });
  expect(result.current).toBe(1);

  act(() => {
    entity.mana = 2;
    entity.mana = 3;
  });
  expect(result.current).toBe(1);

  await waitForFlush();
  expect(result.current).toBe(3);
});

it("keeps the untransformed value stable until the entity changes", async () => {
  const entity: Entity = app.addEntity({ id: "stable-holder", mana: 1 });
  const { result, rerender } = renderHook(() =>
    useListenToEntityProps(entity, ["mana"])
  );
  await waitForFlush();
  const first = result.current;
  expect(first).toEqual({ mana: 1 });

  rerender();
  expect(result.current).toBe(first);

  act(() => {
    entity.mana = 2;
  });
  expect(result.current).not.toBe(first);
  expect(result.current).toEqual({ mana: 2 });
});

it("applies the latest transform closure on rerender", () => {
  const entity: Entity = app.addEntity({ id: "mana-cost", mana: 5 });
  const { result, rerender } = renderHook(
    ({ cost }: { cost: number }) =>
      useListenToEntityProps(
        entity,
        ["mana"],
        ({ mana }) => (mana ?? 0) >= cost,
      ),
    { initialProps: { cost: 3 } },
  );
  expect(result.current).toBe(true);

  rerender({ cost: 10 });
  expect(result.current).toBe(false);
});
