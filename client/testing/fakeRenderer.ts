import {
  Color,
  type Object3D,
  Vector4,
  type WebGLRenderer,
  type WebGLRenderTarget,
} from "three";
import type {
  CornerContext,
  CornerRenderer,
} from "../graphics/rendererState.ts";

type Canvas = { width: number; height: number };

/**
 * Holds the state a WebGLRenderer keeps between draws, and records each
 * clear with the colour it cleared to, for tests of passes that borrow the
 * main renderer.
 */
export const fakeRenderer = (
  { width = 800, height = 600, pixelRatio = 1, onDraw = () => {} }: {
    width?: number;
    height?: number;
    pixelRatio?: number;
    /** Called as each scene is drawn, to look at state mid-frame. */
    onDraw?: (scene: Object3D) => void;
  } = {},
) => {
  const state = {
    target: null as WebGLRenderTarget | null,
    viewport: new Vector4(0, 0, width / pixelRatio, height / pixelRatio),
    scissor: new Vector4(0, 0, width / pixelRatio, height / pixelRatio),
    scissorTest: false,
    clearColor: new Color(0x000000),
    clearAlpha: 1,
  };
  const clears: { color: number; alpha: number; viewport: Vector4 }[] = [];
  const renderer:
    & CornerRenderer<Canvas>
    & Pick<WebGLRenderer, "clear" | "render"> = {
      domElement: { width, height },
      autoClear: true,
      getPixelRatio: () => pixelRatio,
      getRenderTarget: () => state.target,
      setRenderTarget: (target: WebGLRenderTarget | null) => {
        state.target = target;
      },
      getViewport: (target: Vector4) => target.copy(state.viewport),
      setViewport: (
        x: Vector4 | number,
        y?: number,
        w?: number,
        h?: number,
      ) => {
        typeof x === "number"
          ? state.viewport.set(x, y ?? 0, w ?? 0, h ?? 0)
          : state.viewport.copy(x);
      },
      getScissor: (target: Vector4) => target.copy(state.scissor),
      setScissor: (x: Vector4 | number, y?: number, w?: number, h?: number) => {
        typeof x === "number"
          ? state.scissor.set(x, y ?? 0, w ?? 0, h ?? 0)
          : state.scissor.copy(x);
      },
      getScissorTest: () => state.scissorTest,
      setScissorTest: (enabled: boolean) => {
        state.scissorTest = enabled;
      },
      getClearColor: (target: Color) => target.copy(state.clearColor),
      setClearColor: (color: Color | number, alpha = 1) => {
        state.clearColor.set(color);
        state.clearAlpha = alpha;
      },
      getClearAlpha: () => state.clearAlpha,
      clear: () => {
        clears.push({
          color: state.clearColor.getHex(),
          alpha: state.clearAlpha,
          viewport: state.viewport.clone(),
        });
      },
      render: (scene: Object3D) => onDraw(scene),
    };
  return { renderer, state, clears };
};

/** A 2D context that records what it copies, and from where. */
export const fakeContext2d = ({ width = 128, height = 128 } = {}) => {
  const copies: number[][] = [];
  const transforms: string[] = [];
  const ctx = {
    canvas: { width, height },
    drawImage: (_: Canvas, ...rect: number[]) => {
      copies.push(rect);
    },
    save: () => transforms.push("save"),
    restore: () => transforms.push("restore"),
    translate: (x: number, y: number) => transforms.push(`translate ${x} ${y}`),
    scale: (x: number, y: number) => transforms.push(`scale ${x} ${y}`),
  } satisfies CornerContext<Canvas>;
  return { ctx, copies, transforms };
};
