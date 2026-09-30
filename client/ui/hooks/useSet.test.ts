import "@/client-testing/setup.ts";
import { it } from "@std/testing/bdd";
import { expect } from "@std/expect";
import { act, renderHook } from "@testing-library/react";
import { ExtendedSet } from "@/shared/util/ExtendedSet.ts";
import { useSet } from "./useSet.ts";

const nextTick = () =>
  act(() => new Promise((resolve) => setTimeout(resolve, 0)));

it("follows the set when its identity changes", async () => {
  const first = new ExtendedSet<number>();
  const second = new ExtendedSet<number>();
  let renders = 0;
  const { rerender } = renderHook(({ set }) => {
    renders++;
    useSet(set);
  }, { initialProps: { set: first } });

  rerender({ set: second });
  renders = 0;

  second.add(1);
  await nextTick();
  expect(renders).toBe(1);

  first.add(1);
  await nextTick();
  expect(renders).toBe(1);
});
