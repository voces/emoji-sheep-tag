export class DoublyLinkedList<T> {
  private head: T | undefined;
  private tail: T | undefined;
  private next: Map<T, T | undefined> = new Map();
  private prev: Map<T, T | undefined> = new Map();
  public length: number = 0;

  // Append a value to the end of the list
  append(value: T): void {
    if (this.tail === undefined) this.head = this.tail = value;
    else {
      this.next.set(this.tail, value);
      this.prev.set(value, this.tail);
      this.tail = value;
    }
    this.length++;
  }

  delete(value: T): void {
    const prevNode = this.prev.get(value);
    const nextNode = this.next.get(value);

    if (prevNode !== undefined) this.next.set(prevNode, nextNode);
    else this.head = nextNode;

    if (nextNode !== undefined) this.prev.set(nextNode, prevNode);
    else this.tail = prevNode;

    this.next.delete(value);
    this.prev.delete(value);
    this.length--;
  }

  find<
    U extends T,
    Fn extends ((value: T) => value is U) | ((value: T) => boolean),
  >(callback: Fn): (Fn extends ((value: T) => value is U) ? U : T) | undefined {
    let current = this.head;
    while (current) {
      if (callback(current)) {
        return current as (Fn extends ((value: T) => value is U) ? U : T);
      }
      current = this.next.get(current);
    }
  }

  findLast<
    U extends T,
    Fn extends ((value: T) => value is U) | ((value: T) => boolean),
  >(callback: Fn): (Fn extends ((value: T) => value is U) ? U : T) | undefined {
    let current = this.tail;
    while (current) {
      if (callback(current)) {
        return current as (Fn extends ((value: T) => value is U) ? U : T);
      }
      current = this.prev.get(current);
    }
  }

  *[Symbol.iterator](): IterableIterator<T> {
    let current = this.head;
    while (current !== undefined) {
      yield current;
      current = this.next.get(current);
    }
  }

  *inReverse(): IterableIterator<T> {
    let current = this.tail;
    while (current !== undefined) {
      yield current;
      current = this.prev.get(current);
    }
  }
}
