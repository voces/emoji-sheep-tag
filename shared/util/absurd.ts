export const absurd = (v: never) => {
  throw new Error(`Did not expect '${v}'`);
};
