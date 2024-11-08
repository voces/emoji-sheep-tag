export const setFind = <
  T,
  U extends T,
  Fn extends ((element: T) => element is U) | ((element: T) => boolean),
>(
  set: ReadonlySet<T>,
  fn: Fn,
): (Fn extends ((element: T) => element is U) ? U : T) | undefined => {
  for (const element of set) {
    if (fn(element)) {
      return element as
        | (Fn extends ((element: T) => element is U) ? U : T)
        | undefined;
    }
  }
};
