export const setFind: {
  <T, U extends T>(
    set: ReadonlySet<T>,
    fn: (element: T) => element is U,
  ): U | undefined;
  <T>(set: ReadonlySet<T>, fn: (element: T) => boolean): T | undefined;
} = <T>(set: ReadonlySet<T>, fn: (element: T) => boolean) => {
  for (const element of set) if (fn(element)) return element;
};

export const setSome = <T>(
  set: ReadonlySet<T>,
  fn: (element: T) => boolean,
) => {
  for (const element of set) if (fn(element)) return true;
  return false;
};

export const setFirst = <T>(set: ReadonlySet<T>): T | undefined =>
  set.values().next().value;
