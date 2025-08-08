import { Point } from "@/shared/pathing/math.ts";

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
      if (node.point.x === point.x && node.point.y === point.y) {
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
    const D2 = D * D; // Compare squared distances to avoid sqrt computations.

    const searchRec = (node: KdTreeNode | null) => {
      if (node === null) return;

      const dx = node.point.x - x;
      const dy = node.point.y - y;
      const distanceSquared = dx * dx + dy * dy;

      if (distanceSquared <= D2) {
        results.push(node.point);
      }

      const axis = node.axis;
      let diff: number;
      if (axis === 0) {
        diff = x - node.point.x;
      } else {
        diff = y - node.point.y;
      }

      if (diff <= 0) {
        searchRec(node.left);
        if (diff * diff <= D2) {
          searchRec(node.right);
        }
      } else {
        searchRec(node.right);
        if (diff * diff <= D2) {
          searchRec(node.left);
        }
      }
    };

    searchRec(this.root);
    return results;
  }
}
