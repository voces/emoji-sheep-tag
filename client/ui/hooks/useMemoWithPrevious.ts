import { DependencyList, useMemo, useRef } from "react";

export const useMemoWithPrevious = <T>(
  compute: (prev: T | undefined) => T,
  deps: DependencyList,
): T => {
  const prevRef = useRef<T | undefined>(undefined);
  const memoizedValue = useMemo(() => {
    const newValue = compute(prevRef.current);
    prevRef.current = newValue;
    return newValue;
  }, deps);

  return memoizedValue;
};
