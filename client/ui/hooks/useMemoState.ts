import { DependencyList, useCallback, useRef, useState } from "react";

export const useMemoState = <T>(
  init: T | ((previous: T | undefined) => T),
  deps?: DependencyList,
): [value: T, setValue: (newValue: T | ((current: T) => T)) => T] => {
  const [, setUpdateCounter] = useState(0);

  const valueRef = useRef<T>(
    typeof init === "function" ? (init as () => T)() : init,
  );

  deps ??= [init];
  const depsRef = useRef(deps);
  if (
    depsRef.current.length !== deps.length ||
    depsRef.current.some((d, i) => d !== deps[i])
  ) {
    valueRef.current = typeof init === "function"
      ? (init as (previous: T | undefined) => T)(valueRef.current)
      : init;
    depsRef.current = deps;
  }

  const set = useCallback((newValue: T | ((current: T) => T)) => {
    valueRef.current = typeof newValue === "function"
      ? (newValue as (previous: T) => T)(valueRef.current)
      : newValue;
    setUpdateCounter((c) => c + 1);
    return valueRef.current;
  }, []);

  return [valueRef.current, set];
};
