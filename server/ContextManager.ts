// A context is a way to associate data with a particular instance of usage.
// As an example, if we were running unit tests, we'd effectively want a new
// map for each specific test. When we create a unit, it should be created for
// that specific map. This file makes that kind of modeling possible,
// specifically without need of passing around that context reference around,
// and instead using a wrapper method.
// Note that this only works for a given thread, and the context should be set
// at the beginning of the event loop.

// A context is simply an object. We use it in (Weak)Maps.
export type Context = Record<string, unknown>;

/**
 * Generates and returns a new context.
 */
export const newContext = (): Context => ({});

/**
 * Invokes `fn` with the result of `generator` as the first argument.
 */
export const injectContextData = <T, U extends Array<unknown>, G>(
  generator: () => T,
  fn: (data: T, ...args: U) => G,
) =>
(...args: U): G => {
  const data = generator();
  return fn(data, ...args);
};

export class ContextManager<Context extends object> {
  private currentContext: Context | undefined;

  get context(): Context {
    if (!this.currentContext) throw new Error("No context set");
    return this.currentContext;
  }
  set context(newContext: Context | undefined) {
    this.currentContext = newContext;
  }

  /**
   * Sets the current context for the duration of the function. Restores the
   * previous context upon completion.
   */
  with<T>(context: Context, fn: () => T): T {
    const oldContext = this.currentContext;
    this.currentContext = context;
    try {
      return fn();
    } finally {
      this.currentContext = oldContext;
    }
  }

  /**
   * Sets the current context to an ephemeral clone of the current context.
   */
  fork<T>(fn: () => T): T {
    const oldContext = this.context;
    this.currentContext = { ...oldContext };
    try {
      return fn();
    } finally {
      this.currentContext = oldContext;
    }
  }

  /**
   * Returns a memoized function that memoizes on the context.
   */
  memoize<U>(fn: () => U): () => U {
    const map: WeakMap<Context, U> = new WeakMap();

    return (): U => {
      // No memoization if there's no current context
      if (!this.currentContext) return fn();

      if (map.has(this.currentContext)) {
        return map.get(this.currentContext) as U;
      }

      const value = fn();
      map.set(this.currentContext, value);

      return value;
    };
  }

  data<T, U extends Array<unknown>>(
    fn: (...args: U) => T,
    memoize = true,
  ): (...args: U) => T {
    if (memoize) fn = this.memoize(fn);

    return (...args: U): T => fn(...args);
  }

  /**
   * Returns a function that invokes a passed function `fn` with the result of
   * `generator` injected as the first argument.
   */
  dataWrapper<T>(
    generator: () => T,
    memoize = true,
  ): <U extends unknown[], G>(
    fn: (data: T, ...args: U) => G,
  ) => (...args: U) => G {
    if (memoize) generator = this.memoize(generator);

    return <U extends Array<unknown>, G>(
      fn: (data: T, ...args: U) => G,
    ): (...args: U) => G => injectContextData(generator, fn);
  }

  simpleFunctionWrapper<A extends Array<unknown>, B>(
    generator: () => (...args: A) => B,
  ) {
    return <C>(fn: (generatorValue: B) => C): (...args: A) => C => {
      const contextMap = this.data(generator);

      return (...args: A): C => {
        const counter = contextMap();
        const value = counter(...args);
        return fn(value);
      };
    };
  }

  complexFunctionWrapper<A>(generator: () => () => A) {
    return <B extends Array<unknown>, C>(
      fn: (generatorValues: A, ...otherValues: B) => C,
    ): (...args: B) => C => {
      const contextMap = this.data(generator);

      return (...args: B): C => {
        const counter = contextMap();
        const value = counter();
        return fn(value, ...args);
      };
    };
  }
}
