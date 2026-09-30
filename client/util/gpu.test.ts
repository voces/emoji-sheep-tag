import "@/client-testing/setup.ts";
import { expect } from "@std/expect";
import { it } from "@std/testing/bdd";
import { gpuInfoOf, softwareRendererOf } from "./gpu.ts";

/** A context naming `renderer`, counting how often it is asked. */
const context = (renderer: string, vendor = "Google Inc.") => {
  const asked = { count: 0 };
  const gl = {
    getExtension: () => ({
      UNMASKED_RENDERER_WEBGL: 1,
      UNMASKED_VENDOR_WEBGL: 2,
    }),
    getParameter: (name: number) => {
      asked.count++;
      return name === 1 ? renderer : vendor;
    },
  };
  return { gl, asked };
};

it("asks a context for its renderer once, however often it is checked", () => {
  const { gl, asked } = context("ANGLE (Google, Vulkan 1.3.0 (SwiftShader))");
  expect(softwareRendererOf(gl)).toBe(true);
  expect(softwareRendererOf(gl)).toBe(true);
  expect(asked.count).toBe(2);
});

it("asks a new context afresh", () => {
  const hardware = context("ANGLE (NVIDIA GeForce RTX 3080)");
  expect(softwareRendererOf(hardware.gl)).toBe(false);
  const software = context("llvmpipe (LLVM 15.0.7, 256 bits)");
  expect(softwareRendererOf(software.gl)).toBe(true);
  expect([hardware.asked.count, software.asked.count]).toEqual([2, 2]);
});

it("names the renderer and vendor from the same one asking", () => {
  const { gl, asked } = context("ANGLE (NVIDIA GeForce RTX 3080)", "NVIDIA");
  expect(gpuInfoOf(gl)).toEqual({
    renderer: "ANGLE (NVIDIA GeForce RTX 3080)",
    vendor: "NVIDIA",
    software: false,
  });
  softwareRendererOf(gl);
  gpuInfoOf(gl);
  expect(asked.count).toBe(2);
});
