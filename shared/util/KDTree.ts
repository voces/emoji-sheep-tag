import { Point } from "@/shared/pathing/math.ts";
import { BinaryHeap } from "@/shared/pathing/BinaryHeap.ts";

class KdTreeNode {
  point: Point;
  left: KdTreeNode | null = null;
  right: KdTreeNode | null = null;
  axis: number;

  constructor(point: Point, axis: number) {
    this.point = point;
    this.axis = axis;
  }
}

export class KdTree {
  root: KdTreeNode | null = null;

  /**
   * Adds a new point into the K-d tree.
   * @param point The point to add.
   */
  add(point: Point): void {
    const addRec = (
      node: KdTreeNode | null,
      point: Point,
      depth: number,
    ): KdTreeNode => {
      if (node === null) return new KdTreeNode(point, depth % 2);

      if (node.axis === 0) {
        if (point.x < node.point.x) {
          node.left = addRec(node.left, point, depth + 1);
        } else node.right = addRec(node.right, point, depth + 1);
      } else {
        if (point.y < node.point.y) {
          node.left = addRec(node.left, point, depth + 1);
        } else node.right = addRec(node.right, point, depth + 1);
      }

      return node;
    };

    this.root = addRec(this.root, point, 0);
  }

  /**
   * Deletes a point from the K-d tree.
   * @param point The point to delete.
   */
  delete(point: Point): void {
    let found = false;

    const deleteRec = (
      node: KdTreeNode | null,
      point: Point,
    ): KdTreeNode | null => {
      if (node === null) return null;

      const axis = node.axis;

      // Check if this is the node to delete
      if (node.point === point) {
        found = true;
        // If the node has a right child, find the minimum in the right subtree
        if (node.right !== null) {
          const minNode = this.findMin(node.right, axis);
          node.point = minNode.point;
          node.right = deleteRec(node.right, minNode.point);
        } // Else if the node has a left child, find the minimum in the left subtree
        else if (node.left !== null) {
          const minNode = this.findMin(node.left, axis);
          node.point = minNode.point;
          node.right = deleteRec(node.left, minNode.point);
          node.left = null;
        } // Else, it's a leaf node
        else return null;
      } else {
        if (axis === 0) {
          if (point.x < node.point.x) node.left = deleteRec(node.left, point);
          else node.right = deleteRec(node.right, point);
        } else {
          if (point.y < node.point.y) node.left = deleteRec(node.left, point);
          else node.right = deleteRec(node.right, point);
        }
      }

      return node;
    };

    this.root = deleteRec(this.root, point);

    if (!found) console.warn("Did not find point in kd tree!");
  }

  /**
   * Replaces an existing point with a new point (effectively moving it).
   * @param oldPoint The point to be replaced.
   * @param newPoint The new point.
   */
  replace(oldPoint: Point, newPoint: Point): void {
    this.delete(oldPoint);
    this.add(newPoint);
  }

  /**
   * Finds the node with minimum value along a given axis.
   * @param node The subtree root.
   * @param axis The axis to compare.
   */
  private findMin(
    node: KdTreeNode | null,
    axis: number,
  ): KdTreeNode {
    if (node === null) throw new Error("Node cannot be null");

    const currentAxis = node.axis;

    if (currentAxis === axis) {
      if (node.left === null) return node;
      return this.findMin(node.left, axis);
    } else {
      const leftMin = node.left ? this.findMin(node.left, axis) : node;
      const rightMin = node.right ? this.findMin(node.right, axis) : node;

      let minNode = node;
      if (axis === 0) {
        if (leftMin.point.x < minNode.point.x) minNode = leftMin;
        if (rightMin.point.x < minNode.point.x) minNode = rightMin;
      } else {
        if (leftMin.point.y < minNode.point.y) minNode = leftMin;
        if (rightMin.point.y < minNode.point.y) minNode = rightMin;
      }

      return minNode;
    }
  }

  /**
   * Returns all points within the rectangle defined by (x1, y1) and (x2, y2).
   * @param x1 X-coordinate of the first corner.
   * @param y1 Y-coordinate of the first corner.
   * @param x2 X-coordinate of the opposite corner.
   * @param y2 Y-coordinate of the opposite corner.
   */
  rangeSearchRect(x1: number, y1: number, x2: number, y2: number): Point[] {
    const results: Point[] = [];

    const searchRec = (node: KdTreeNode | null) => {
      if (node === null) return;

      const { x, y } = node.point;
      if (x >= x1 && x <= x2 && y >= y1 && y <= y2) {
        results.push(node.point);
      }

      const axis = node.axis;
      if (axis === 0) {
        if (x1 <= node.point.x) searchRec(node.left);
        if (x2 >= node.point.x) searchRec(node.right);
      } else {
        if (y1 <= node.point.y) searchRec(node.left);
        if (y2 >= node.point.y) searchRec(node.right);
      }
    };

    searchRec(this.root);
    return results;
  }

  /**
   * Returns all points within distance D from point (x, y).
   * @param x X-coordinate of the center point.
   * @param y Y-coordinate of the center point.
   * @param D The distance (radius) from the center point.
   */
  rangeSearchCircle(x: number, y: number, D: number): Point[] {
    const results: Point[] = [];
    for (const point of this.iterateInRange(x, y, D)) {
      results.push(point);
    }
    return results;
  }

  /**
   * Yields all points within distance D from point (x, y).
   * Allows early termination via generator protocol.
   * @param x X-coordinate of the center point.
   * @param y Y-coordinate of the center point.
   * @param D The distance (radius) from the center point.
   */
  *iterateInRange(x: number, y: number, D: number): Generator<Point> {
    if (!this.root) return;

    const D2 = D * D;
    const stack: KdTreeNode[] = [this.root];

    while (stack.length > 0) {
      const node = stack.pop()!;

      const dx = node.point.x - x;
      const dy = node.point.y - y;
      const distanceSquared = dx * dx + dy * dy;

      if (distanceSquared <= D2) {
        yield node.point;
      }

      const diff = node.axis === 0 ? x - node.point.x : y - node.point.y;

      if (diff <= 0) {
        if (node.left) stack.push(node.left);
        if (diff * diff <= D2 && node.right) stack.push(node.right);
      } else {
        if (node.right) stack.push(node.right);
        if (diff * diff <= D2 && node.left) stack.push(node.left);
      }
    }
  }

  /**
   * Returns the nearest point to (x, y) for which filter(point) returns true.
   * The filter is invoked strictly in order of nearest→farthest, and stops
   * at the first true result. Returns null if no point satisfies the filter.
   */
  nearest(x: number, y: number, filter: (p: Point) => boolean): Point | null {
    if (!this.root) return null;

    type Bounds = { minX: number; minY: number; maxX: number; maxY: number };

    // Distance helpers (squared distances to avoid sqrt).
    const dist2Point = (p: Point) => {
      const dx = p.x - x;
      const dy = p.y - y;
      return dx * dx + dy * dy;
    };
    const clamp = (v: number, lo: number, hi: number) =>
      v < lo ? lo : v > hi ? hi : v;
    const dist2Rect = (b: Bounds) => {
      const cx = clamp(x, b.minX, b.maxX);
      const cy = clamp(y, b.minY, b.maxY);
      const dx = cx - x;
      const dy = cy - y;
      return dx * dx + dy * dy;
    };

    // We push two kinds of work items: regions (subtrees) and actual points.
    type NodeItem = {
      kind: "node";
      node: KdTreeNode;
      bounds: Bounds;
      key: number; // lower bound distance^2 to the region
    };
    type PointItem = {
      kind: "point";
      point: Point;
      key: number; // exact distance^2 to the point
    };
    type Item = NodeItem | PointItem;

    const heap = new BinaryHeap<Item>((it) => it.key);

    // Start with the root covering all space (use large finite bounds).
    const INF = Number.POSITIVE_INFINITY;
    const rootBounds: Bounds = { minX: -INF, minY: -INF, maxX: INF, maxY: INF };
    heap.push({ kind: "node", node: this.root, bounds: rootBounds, key: 0 });

    // Expand a node into its point and its children regions.
    const enqueueChildren = (n: KdTreeNode, b: Bounds) => {
      // Enqueue the node's point itself (so points are tested in true nearest-first order).
      heap.push({ kind: "point", point: n.point, key: dist2Point(n.point) });

      // Split bounds for children based on axis.
      if (n.left) {
        const lb: Bounds = n.axis === 0
          ? { minX: b.minX, maxX: n.point.x, minY: b.minY, maxY: b.maxY }
          : { minX: b.minX, maxX: b.maxX, minY: b.minY, maxY: n.point.y };
        heap.push({
          kind: "node",
          node: n.left,
          bounds: lb,
          key: dist2Rect(lb),
        });
      }
      if (n.right) {
        const rb: Bounds = n.axis === 0
          ? { minX: n.point.x, maxX: b.maxX, minY: b.minY, maxY: b.maxY }
          : { minX: b.minX, maxX: b.maxX, minY: n.point.y, maxY: b.maxY };
        heap.push({
          kind: "node",
          node: n.right,
          bounds: rb,
          key: dist2Rect(rb),
        });
      }
    };

    // Best-first search: always expand the closest pending thing.
    while (heap.length) {
      const item = heap.pop()!;
      if (item.kind === "point") {
        // Call the filter in strictly nearest-first order.
        if (filter(item.point)) return item.point;
        // else keep going
      } else {
        // Expand this subtree: its lower-bound distance is <= any of its contents.
        enqueueChildren(item.node, item.bounds);
      }
    }

    return null; // no point satisfied the filter
  }
}
