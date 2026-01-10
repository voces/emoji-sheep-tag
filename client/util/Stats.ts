const newPanel = () => {
  const obj = {
    value: NaN,
    update: (value: number) => {
      obj.value = value;
    },
  };
  return obj;
};

const newStats = () => {
  let beginTime = (performance || Date).now(), prevTime = beginTime, frames = 0;

  const msPanel = newPanel();
  const fpsPanel = newPanel();

  const end = () => {
    frames++;
    const time = (performance || Date).now();

    if (time >= prevTime + 1000) {
      fpsPanel.update((frames * 1000) / (time - prevTime));
      prevTime = time;
      frames = 0;
    }

    return time;
  };

  return {
    begin: () => {
      beginTime = (performance || Date).now();
    },
    end,
    update: () => {
      beginTime = end();
    },
    fpsPanel,
    msPanel,
  };
};

export const stats = newStats();
