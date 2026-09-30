import "@/client-testing/setup.ts";
import { expect } from "@std/expect";
import { it } from "@std/testing/bdd";
import { Color } from "three";
import { fakeContext2d, fakeRenderer } from "@/client-testing/fakeRenderer.ts";
import { drawPortrait } from "./PortraitCanvas.tsx";

it("clears the portrait to grey but leaves the world's clear colour as it was", () => {
  const { renderer, clears } = fakeRenderer();
  renderer.setClearColor(0x020a00, 1);

  drawPortrait(renderer, fakeContext2d().ctx, () => {});

  expect(clears.map((c) => c.color)).toEqual([0x222222]);
  const color = renderer.getClearColor(new Color());
  expect(color.getHex()).toBe(0x020a00);
});
