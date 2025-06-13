export const delay = (timeout: number = 0) =>
  new Promise((resolve) => setTimeout(resolve, timeout));
