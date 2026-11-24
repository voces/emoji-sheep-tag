import { expect, test } from "vitest";
import {
  ShaderLib,
  WebGLProgramParametersWithUniforms,
  WebGLRenderer,
} from "three";
import {
  createAnimatedMeshMaterial,
  onShaderReady,
} from "./AnimatedMeshMaterial.ts";

const compile = (material: ReturnType<typeof createAnimatedMeshMaterial>) =>
  material.onBeforeCompile(
    {
      uniforms: {},
      vertexShader: ShaderLib.basic.vertexShader,
      fragmentShader: ShaderLib.basic.fragmentShader,
    } as Partial<
      WebGLProgramParametersWithUniforms
    > as WebGLProgramParametersWithUniforms,
    {} as WebGLRenderer,
  );

test("onShaderReady runs every callback registered before compile", () => {
  const material = createAnimatedMeshMaterial();
  const calls: string[] = [];
  onShaderReady(material, () => calls.push("first"));
  onShaderReady(material, () => calls.push("second"));

  compile(material);
  compile(material);

  expect(calls).toEqual(["first", "second"]);
});
