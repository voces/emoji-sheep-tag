export const yieldFor = function* (seconds: number) {
  let remaining = seconds * 1000;
  let last = Date.now();
  while (remaining > 0) {
    yield;
    const now = Date.now();
    remaining -= now - last;
    last = now;
  }
};
