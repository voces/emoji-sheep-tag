import { useCallback, useRef, useSyncExternalStore } from "react";
import { deepEqual } from "../util/deepEqual.ts";

type SetValue<T> = undefined extends T ? T | ((oldValue: T) => T) // Allow explicit `undefined` if T already includes it.
  : Exclude<T, undefined> | ((oldValue: T) => T); // Otherwise, exclude it.

type ReactiveVar<T> = {
  (): T;
  (newValue: SetValue<T>): T;
  subscribe: (callback: (newValue: T, prevValue: T) => void) => () => void;
};

const resets: (() => void)[] = [];

export const makeVar = <
  T extends object | string | number | boolean | undefined,
>(
  initialValue: T,
): ReactiveVar<T> => {
  let value = initialValue;
  const listeners: Set<(newValue: T, prevValue: T) => void> = new Set();

  const subscribe = (callback: (newValue: T, prevValue: T) => void) => {
    listeners.add(callback);
    return () => listeners.delete(callback);
  };

  const fn = (...args: [T | ((oldValue: T) => T)]) => {
    if (args.length) {
      const newValue = args[0];
      const oldValue = value;
      const actualNewValue = typeof newValue === "function"
        ? newValue(value)
        : newValue;
      value = actualNewValue;
      if (oldValue !== actualNewValue) {
        for (const listener of listeners) listener(actualNewValue, oldValue);
      }
    }
    return value;
  };

  resets.push(() => fn(initialValue));

  return Object.assign(fn, { subscribe }) as unknown as ReactiveVar<T>;
};

export const useReactiveVar = <T, S = T>(
  reactiveVar: ReactiveVar<T>,
  selector?: (value: T) => S,
): S => {
  // Store selector in ref to keep subscribe stable
  const selectorRef = useRef(selector);
  selectorRef.current = selector;

  // Cache the selected value to return stable reference
  const cachedRef = useRef<{ value: S; source: T } | null>(null);

  const subscribe = useCallback(
    (callback: () => void) => {
      if (!selectorRef.current) {
        return reactiveVar.subscribe(callback);
      }
      return reactiveVar.subscribe(() => {
        const source = reactiveVar();
        const newSelected = selectorRef.current!(source);
        if (!deepEqual(cachedRef.current?.value, newSelected)) {
          cachedRef.current = { value: newSelected, source };
          callback();
        }
      });
    },
    [reactiveVar],
  );

  const getSnapshot = useCallback(() => {
    if (!selectorRef.current) return reactiveVar() as unknown as S;

    const source = reactiveVar();
    // Return cached value if source hasn't changed
    if (cachedRef.current && cachedRef.current.source === source) {
      return cachedRef.current.value;
    }
    // Compute and cache new value
    const value = selectorRef.current(source);
    cachedRef.current = { value, source };
    return value;
  }, [reactiveVar]);

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
};

export const __testing_reset_all_vars = () => {
  for (const fn of resets) fn();
};
