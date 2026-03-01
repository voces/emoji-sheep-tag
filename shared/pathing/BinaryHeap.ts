export class BinaryHeap<T> extends Array<T> {
  scoreFunc: (element: T) => number;
  private indexMap: Map<T, number> = new Map();
  private scores: number[] = [];

  constructor(scoreFunc: (element: T) => number) {
    super();
    this.scoreFunc = scoreFunc;
  }

  override push(element: T): number {
    const idx = super.push(element) - 1;
    this.indexMap.set(element, idx);
    this.bubbleUp(idx);
    return 0;
  }

  override pop(): T {
    const top = this[0];
    const end = this.length - 1;
    this.indexMap.delete(top);

    if (end > 0) {
      const bottom = this[end];
      super.pop();
      this[0] = bottom;
      this.scores[0] = this.scores[end];
      this.indexMap.set(bottom, 0);
      this.sinkDown(0);
    } else {
      super.pop();
    }

    return top;
  }

  remove(element: T): void {
    const i = this.indexMap.get(element);
    if (i === undefined) return;

    const end = this.length - 1;
    this.indexMap.delete(element);

    if (i === end) {
      super.pop();
      return;
    }

    const bottom = this[end];
    super.pop();
    this[i] = bottom;
    this.scores[i] = this.scores[end];
    this.indexMap.set(bottom, i);
    this.bubbleUp(i);
    this.sinkDown(i);
  }

  override indexOf(element: T): number {
    return this.indexMap.get(element) ?? -1;
  }

  bubbleUp(index: number): void {
    const element = this[index];
    const score = this.scoreFunc(element);
    this.scores[index] = score;

    while (index > 0) {
      const parentIndex = ((index + 1) >> 1) - 1;
      const parentScore = this.scores[parentIndex];

      if (score >= parentScore) break;

      const parent = this[parentIndex];
      this[parentIndex] = element;
      this[index] = parent;
      this.scores[parentIndex] = score;
      this.scores[index] = parentScore;
      this.indexMap.set(parent, index);

      index = parentIndex;
    }

    this.indexMap.set(element, index);
  }

  sinkDown(index: number): void {
    const length = this.length;
    const element = this[index];
    const score = this.scoreFunc(element);
    this.scores[index] = score;

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const rightIndex = (index + 1) * 2;
      const leftIndex = rightIndex - 1;

      let swapIndex: number | undefined;
      let swapScore = score;

      if (leftIndex < length) {
        const leftScore = this.scores[leftIndex];
        if (leftScore < swapScore) {
          swapIndex = leftIndex;
          swapScore = leftScore;
        }
      }

      if (rightIndex < length) {
        const rightScore = this.scores[rightIndex];
        if (rightScore < swapScore) {
          swapIndex = rightIndex;
        }
      }

      if (swapIndex === undefined) break;

      const swapped = this[swapIndex];
      const swappedScore = this.scores[swapIndex];
      this[index] = swapped;
      this[swapIndex] = element;
      this.scores[index] = swappedScore;
      this.scores[swapIndex] = score;
      this.indexMap.set(swapped, index);
      index = swapIndex;
    }

    this.indexMap.set(element, index);
  }
}
