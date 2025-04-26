//@deno-types="npm:@types/react"
import { useEffect, useState } from "react";

type SetValue<T> = undefined extends T ? T | ((oldValue: T) => T) // Allow explicit `undefined` if T already includes it.
  : Exclude<T, undefined> | ((oldValue: T) => T); // Otherwise, exclude it.

type ReactiveVar<T> = {
  (): T;
  (newValue: SetValue<T>): T;
  subscribe: (callback: (newValue: T, prevValue: T) => void) => () => void;
};

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

  return Object.assign(fn, { subscribe }) as unknown as ReactiveVar<T>;
};

export const useReactiveVar = <T,>(reactiveVar: ReactiveVar<T>): T => {
  const [value, setValue] = useState(reactiveVar());

  useEffect(
    () => reactiveVar.subscribe((newValue) => setValue(newValue)),
    [],
  );

  return value;
};
