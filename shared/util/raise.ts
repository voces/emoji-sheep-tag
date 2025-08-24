export const raise = (error: Error | string): never => {
  if (error instanceof Error) throw error;
  throw new Error(error);
};
