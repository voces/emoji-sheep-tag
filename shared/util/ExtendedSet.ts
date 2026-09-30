type ExtendedSetEventMap<T> = {
  add: T;
  delete: T;
};

type ExtendedSetListener<T, K extends keyof ExtendedSetEventMap<T>> = (
  ev: ExtendedSetEventMap<T>[K],
) => void;

type ExtendedSetListeners<T> = {
  [K in keyof ExtendedSetEventMap<T>]?: ExtendedSetListener<T, K>[];
};

export class ExtendedSet<T> extends Set<T> {
  /** Optional because Set's constructor calls `add` before fields initialize. */
  private eventListeners?: ExtendedSetListeners<T> = {};

  override add(value: T): this {
    super.add(value);
    this.dispatchEvent("add", value);
    return this;
  }

  override delete(value: T): boolean {
    const result = super.delete(value);
    if (result) this.dispatchEvent("delete", value);
    return result;
  }

  /** Returns true if `predicate` returns a truthy value for any element. */
  some(predicate: (value: T) => unknown) {
    for (const value of this) if (predicate(value)) return true;
    return false;
  }

  every(predicate: (value: T) => unknown) {
    for (const value of this) if (!predicate(value)) return false;
    return true;
  }

  filter<U extends T>(
    predicate: ((value: T) => value is U) | ((value: T) => unknown),
  ) {
    const newSet = new ExtendedSet<U>();
    for (const entity of this) if (predicate(entity)) newSet.add(entity as U);
    return newSet;
  }

  clone() {
    return new ExtendedSet(this);
  }

  first() {
    return this.values().next().value;
  }

  get length() {
    return this.size;
  }

  map<U>(mapper: (item: T) => U): U[] {
    const result: U[] = [];
    for (const item of this) result.push(mapper(item));
    return result;
  }

  find(predicate: (item: T) => boolean) {
    for (const item of this) if (predicate(item)) return item;
  }

  addEventListener<K extends keyof ExtendedSetEventMap<T>>(
    type: K,
    listener: ExtendedSetListener<T, K>,
  ) {
    const listeners: ExtendedSetListener<T, K>[] =
      (this.eventListeners ??= {})[type] ??= [];
    listeners.push(listener);

    return () => {
      const idx = listeners.indexOf(listener);
      if (idx >= 0) listeners.splice(idx, 1);
    };
  }

  private dispatchEvent<K extends keyof ExtendedSetEventMap<T>>(
    type: K,
    event: ExtendedSetEventMap<T>[K],
  ) {
    this.eventListeners?.[type]?.forEach((listener) =>
      listener.call(this, event)
    );
  }
}
