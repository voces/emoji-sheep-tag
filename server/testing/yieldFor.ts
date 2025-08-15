export const yieldFor = (seconds: number) =>
  function* () {
    let remaining = seconds * 1000;
    let last = Date.now();
    while (remaining > 0) {
      yield;
      const now = Date.now();
      remaining -= now - last;
      last = now;
    }
  };
