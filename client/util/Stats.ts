const newPanel = (name: string, fg: string, bg: string) => {
  let min = Infinity, max = 0, round = Math.round;
  const PR = round(window.devicePixelRatio || 1);

  const WIDTH = 80 * PR,
    HEIGHT = 48 * PR,
    TEXT_X = 3 * PR,
    TEXT_Y = 2 * PR,
    GRAPH_X = 3 * PR,
    GRAPH_Y = 15 * PR,
    GRAPH_WIDTH = 74 * PR,
    GRAPH_HEIGHT = 30 * PR;

  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  canvas.style.cssText = "width:80px;height:48px";

  const context = canvas.getContext("2d")!;
  context.font = "bold " + (9 * PR) + "px Helvetica,Arial,sans-serif";
  context.textBaseline = "top";

  context.fillStyle = bg;
  context.fillRect(0, 0, WIDTH, HEIGHT);

  context.fillStyle = fg;
  context.fillText(name, TEXT_X, TEXT_Y);
  context.fillRect(GRAPH_X, GRAPH_Y, GRAPH_WIDTH, GRAPH_HEIGHT);

  context.fillStyle = bg;
  context.globalAlpha = 0.9;
  context.fillRect(GRAPH_X, GRAPH_Y, GRAPH_WIDTH, GRAPH_HEIGHT);

  const obj = {
    dom: canvas,

    value: NaN,

    update: (value: number, maxValue: number) => {
      obj.value = value;

      min = Math.min(min, value);
      max = Math.max(max, value);

      context.fillStyle = bg;
      context.globalAlpha = 1;
      context.fillRect(0, 0, WIDTH, GRAPH_Y);
      context.fillStyle = fg;
      context.fillText(
        round(value) + " " + name + " (" + round(min) + "-" + round(max) + ")",
        TEXT_X,
        TEXT_Y,
      );

      context.drawImage(
        canvas,
        GRAPH_X + PR,
        GRAPH_Y,
        GRAPH_WIDTH - PR,
        GRAPH_HEIGHT,
        GRAPH_X,
        GRAPH_Y,
        GRAPH_WIDTH - PR,
        GRAPH_HEIGHT,
      );

      context.fillRect(GRAPH_X + GRAPH_WIDTH - PR, GRAPH_Y, PR, GRAPH_HEIGHT);

      context.fillStyle = bg;
      context.globalAlpha = 0.9;
      context.fillRect(
        GRAPH_X + GRAPH_WIDTH - PR,
        GRAPH_Y,
        PR,
        round((1 - (value / Math.max(max, maxValue))) * GRAPH_HEIGHT),
      );
    },
  };

  return obj;
};

const newStats = () => {
  let mode = 0;

  let container = document.createElement("div");
  container.style.cssText =
    "position:fixed;top:0;left:0;cursor:pointer;opacity:0.9;z-index:10000";
  container.addEventListener("click", (event) => {
    event.preventDefault();
    showPanel(++mode % container.children.length);
  }, false);

  //

  const addPanel = (panel: ReturnType<typeof newPanel>) => {
    container.appendChild(panel.dom);
    return panel;
  };

  const showPanel = (id: number) => {
    for (let i = 0; i < container.children.length; i++) {
      (container.children[i] as HTMLElement).style.display = i === id
        ? "block"
        : "none";
    }

    mode = id;
  };

  //

  let beginTime = (performance || Date).now(), prevTime = beginTime, frames = 0;

  let fpsPanel = addPanel(newPanel("FPS", "#0ff", "#002"));
  let msPanel = addPanel(newPanel("MS", "#0f0", "#020"));
  let memPanel: ReturnType<typeof newPanel> | undefined;

  if (self.performance && "memory" in self.performance) {
    memPanel = addPanel(newPanel("MB", "#f08", "#201"));
  }

  showPanel(0);

  const end = () => {
    frames++;

    var time = (performance || Date).now();

    // msPanel.update(time - beginTime, 200);

    if (time >= prevTime + 1000) {
      fpsPanel.update((frames * 1000) / (time - prevTime), 100);

      prevTime = time;
      frames = 0;

      if (memPanel) {
        var memory = "memory" in performance ? performance.memory : undefined;
        memPanel.update(
          (memory as { usedJSHeapSize: number }).usedJSHeapSize / 1048576,
          (memory as { jsHeapSizeLimit: number }).jsHeapSizeLimit / 1048576,
        );
      }
    }

    return time;
  };

  return {
    REVISION: 16,

    dom: container,

    addPanel: addPanel,
    showPanel: showPanel,

    begin: () => {
      beginTime = (performance || Date).now();
    },

    end,

    update: () => {
      beginTime = end();
    },

    fpsPanel,
    msPanel,
    memPanel,

    // Backwards Compatibility

    domElement: container,
    setMode: showPanel,
  };
};

export const stats = newStats();
document.body.appendChild(stats.dom);
