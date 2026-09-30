import { Color, Vector4, type WebGLRenderer } from "three";

/** The parts of a renderer whose state a pass may change and must put back. */
export type StatefulRenderer = Pick<
  WebGLRenderer,
  | "getRenderTarget"
  | "setRenderTarget"
  | "getViewport"
  | "setViewport"
  | "getScissor"
  | "setScissor"
  | "getScissorTest"
  | "setScissorTest"
  | "getClearColor"
  | "setClearColor"
  | "getClearAlpha"
  | "autoClear"
>;

type Snapshot = {
  target: ReturnType<WebGLRenderer["getRenderTarget"]>;
  viewport: Vector4;
  scissor: Vector4;
  scissorTest: boolean;
  clearColor: Color;
  clearAlpha: number;
  autoClear: boolean;
};

/** One snapshot per nesting depth, reused across frames. */
const snapshots: Snapshot[] = [];
let depth = 0;

const takeSnapshot = (renderer: StatefulRenderer) => {
  const snapshot = snapshots[depth] ??= {
    target: null,
    viewport: new Vector4(),
    scissor: new Vector4(),
    scissorTest: false,
    clearColor: new Color(),
    clearAlpha: 1,
    autoClear: true,
  };
  snapshot.target = renderer.getRenderTarget();
  renderer.getViewport(snapshot.viewport);
  renderer.getScissor(snapshot.scissor);
  snapshot.scissorTest = renderer.getScissorTest();
  renderer.getClearColor(snapshot.clearColor);
  snapshot.clearAlpha = renderer.getClearAlpha();
  snapshot.autoClear = renderer.autoClear;
  return snapshot;
};

/**
 * The viewport, scissor and scissor test apply to whichever target is bound,
 * so the target goes back last: binding it re-applies its own viewport and
 * scissor, or the canvas's just restored ones.
 */
const restoreSnapshot = (renderer: StatefulRenderer, snapshot: Snapshot) => {
  renderer.setViewport(snapshot.viewport);
  renderer.setScissor(snapshot.scissor);
  renderer.setScissorTest(snapshot.scissorTest);
  renderer.setClearColor(snapshot.clearColor, snapshot.clearAlpha);
  renderer.autoClear = snapshot.autoClear;
  renderer.setRenderTarget(snapshot.target);
};

/**
 * Runs `fn`, then puts back the renderer's render target, viewport, scissor,
 * scissor test, clear colour and alpha, and autoClear, however `fn` left them.
 */
export const withRendererState = <T>(
  renderer: StatefulRenderer,
  fn: () => T,
): T => {
  const snapshot = takeSnapshot(renderer);
  depth++;
  try {
    return fn();
  } finally {
    depth--;
    restoreSnapshot(renderer, snapshot);
  }
};

type Size = { width: number; height: number };

/** A canvas-backed renderer: `Source` is its drawing buffer's canvas. */
export type CornerRenderer<Source extends Size> = StatefulRenderer & {
  domElement: Source;
  getPixelRatio: () => number;
};

/** A 2D context that can copy from `Source`. */
export type CornerContext<Source> = {
  canvas: Size;
  drawImage: (
    image: Source,
    sx: number,
    sy: number,
    sw: number,
    sh: number,
    dx: number,
    dy: number,
    dw: number,
    dh: number,
  ) => void;
  save: () => void;
  restore: () => void;
  translate: (x: number, y: number) => void;
  scale: (x: number, y: number) => void;
};

/**
 * Draws into the bottom-left `width` by `height` device pixels of the
 * renderer's canvas and copies that rect onto all of `ctx`'s canvas. Valid
 * while it runs inside the render loop, before the frame is presented; the
 * game render that follows overwrites the corner again. `flipY` mirrors the
 * copy for cameras that draw upside down.
 */
export const renderInCorner = <Source extends Size>(
  renderer: CornerRenderer<Source>,
  ctx: CornerContext<Source>,
  { width, height, flipY = false }: {
    width: number;
    height: number;
    flipY?: boolean;
  },
  draw: () => void,
) =>
  withRendererState(renderer, () => {
    const source = renderer.domElement;
    const target = ctx.canvas;
    const ratio = renderer.getPixelRatio();
    renderer.setRenderTarget(null);
    renderer.setViewport(0, 0, width / ratio, height / ratio);
    renderer.setScissor(0, 0, width / ratio, height / ratio);
    renderer.setScissorTest(true);
    draw();

    if (flipY) {
      ctx.save();
      ctx.translate(0, target.height);
      ctx.scale(1, -1);
    }
    ctx.drawImage(
      source,
      0,
      source.height - Math.round(height),
      Math.round(width),
      Math.round(height),
      0,
      0,
      target.width,
      target.height,
    );
    if (flipY) ctx.restore();
  });
