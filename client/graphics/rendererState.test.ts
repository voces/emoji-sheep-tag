import { expect } from "@std/expect";
import { it } from "@std/testing/bdd";
import { Vector4, WebGLRenderTarget } from "three";
import { fakeContext2d, fakeRenderer } from "@/client-testing/fakeRenderer.ts";
import { renderInCorner, withRendererState } from "./rendererState.ts";

it("puts back every piece of renderer state, even when the pass throws", () => {
  const { renderer, state } = fakeRenderer();
  const target = new WebGLRenderTarget(4, 4);
  renderer.setRenderTarget(target);
  renderer.setClearColor(0x020a00, 0.5);
  const before = structuredClone({ ...state, target: undefined });

  expect(() =>
    withRendererState(renderer, () => {
      renderer.setRenderTarget(null);
      renderer.setViewport(1, 2, 3, 4);
      renderer.setScissor(5, 6, 7, 8);
      renderer.setScissorTest(true);
      renderer.setClearColor(0xffffff, 1);
      renderer.autoClear = false;
      withRendererState(renderer, () => renderer.setClearColor(0x123456, 0));
      throw new Error("pass failed");
    })
  ).toThrow("pass failed");

  expect(state.target).toBe(target);
  expect(structuredClone({ ...state, target: undefined })).toEqual(before);
  expect(renderer.autoClear).toBe(true);
});

it("draws into the canvas's bottom-left corner and copies that rect out", () => {
  const { renderer, state } = fakeRenderer({
    width: 800,
    height: 600,
    pixelRatio: 2,
  });
  const { ctx, copies, transforms } = fakeContext2d({
    width: 250,
    height: 250,
  });
  const viewports: Vector4[] = [];

  renderInCorner(renderer, ctx, { width: 250, height: 250 }, () => {
    viewports.push(state.viewport.clone(), state.scissor.clone());
    expect(state.scissorTest).toBe(true);
  });

  expect(viewports).toEqual([
    new Vector4(0, 0, 125, 125),
    new Vector4(0, 0, 125, 125),
  ]);
  expect(copies).toEqual([[0, 350, 250, 250, 0, 0, 250, 250]]);
  expect(transforms).toEqual([]);
  expect(state.scissorTest).toBe(false);
});
