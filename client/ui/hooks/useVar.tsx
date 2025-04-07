//@deno-types="npm:@types/react"
import { useEffect, useState } from "react";

type ReactiveVar<T> = ((newValue?: T | ((oldValue: T) => T)) => T) & {
  subscribe: (callback: (newValue: T, prevValue: T) => void) => () => void;
};

export const makeVar = <
  T extends object | string | number | boolean | undefined,
>(
  initialValue: T,
): ReactiveVar<T> => {
  let value = initialValue;
  let listeners: Set<(newValue: T, prevValue: T) => void> = new Set();

  const subscribe = (callback: (newValue: T, prevValue: T) => void) => {
    listeners.add(callback);
    return () => listeners.delete(callback);
  };

  const fn = (newValue?: T | ((oldValue: T) => T)) => {
    if (newValue) {
      const oldValue = value;
      const actualNewValue = typeof newValue === "function"
        ? newValue(value)
        : newValue;
      value = actualNewValue;
      for (const listener of listeners) listener(actualNewValue, oldValue);
    }
    return value;
  };

  return Object.assign(fn, { subscribe }) as ReactiveVar<T>;
};

export const useReactiveVar = <T,>(reactiveVar: ReactiveVar<T>): T => {
  const [value, setValue] = useState(reactiveVar());

  useEffect(
    () => reactiveVar.subscribe((newValue) => setValue(newValue)),
    [],
  );

  return value;
};
