export const shuffle = <T>(arr: T[]): T[] => {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const n = Math.floor(Math.random() * (i + 1));
    [result[i], result[n]] = [result[n], result[i]];
  }
  return result;
};
