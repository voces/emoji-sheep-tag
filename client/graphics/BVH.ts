import { Box3, Ray, Vector3 } from "three";

const tempVec = new Vector3();
const sizeVec = new Vector3();
const centreVec = new Vector3();
const combinedBox = new Box3();
const childBox = new Box3();

type BVHNode = {
  parent: number;
  left: number;
  right: number;
  height: number;
  box: Box3;
  index: number; // only valid if leaf
};

export class BVH {
  private nodes: BVHNode[] = [];
  private root: number = -1;
  private freeList: number = -1;
  private map: number[] = [];
  private count = 0;

  // Batching state
  private pendingUpdates: Map<number, Box3 | null> = new Map(); // null = remove
  private spareBoxes: Box3[] = [];
  private flushScheduled = false;
  private getBoundingBox?: (index: number) => Box3 | null;

  constructor(readonly name?: string) {}

  /** Set a callback to get bounding boxes for indices during rebuild */
  setGetBoundingBox(fn: (index: number) => Box3 | null) {
    this.getBoundingBox = fn;
  }

  /**
   * Queue an update to be applied in the next microtask. The box is copied, so
   * callers may reuse it.
   */
  queueUpdate(index: number, boundingBox: Box3 | null) {
    const pending = this.pendingUpdates.get(index);
    if (boundingBox) {
      this.pendingUpdates.set(
        index,
        (pending ?? this.takeBox()).copy(boundingBox),
      );
    } else {
      if (pending) this.spareBoxes.push(pending);
      this.pendingUpdates.set(index, null);
    }
    this.scheduleFlush();
  }

  private takeBox() {
    return this.spareBoxes.pop() ?? new Box3();
  }

  private scheduleFlush() {
    if (this.flushScheduled) return;
    this.flushScheduled = true;
    queueMicrotask(() => this.flush());
  }

  private flush() {
    this.flushScheduled = false;
    if (this.pendingUpdates.size === 0) return;

    // Decide whether to rebuild or apply individually
    // Rebuild if > 100 updates or updating > 50% of current entries
    const currentCount = this.count;
    const updateCount = this.pendingUpdates.size;
    const shouldRebuild = updateCount > 100 ||
      (currentCount > 0 && updateCount / currentCount > 0.5);

    if (shouldRebuild && this.getBoundingBox) {
      // Collect all entries for rebuild
      const entries: { index: number; boundingBox: Box3 }[] = [];

      // First, gather indices that exist or will exist
      const allIndices = new Set<number>();
      for (let i = 0; i < this.map.length; i++) {
        if (this.map[i] !== undefined) allIndices.add(i);
      }
      for (const [index] of this.pendingUpdates) {
        allIndices.add(index);
      }

      for (const i of allIndices) {
        if (this.pendingUpdates.has(i)) {
          const box = this.pendingUpdates.get(i);
          if (box) {
            entries.push({ index: i, boundingBox: box });
          }
          // null means remove, skip it
        } else {
          // Not in pending updates, get current bounding box
          const box = this.getBoundingBox(i);
          if (box) {
            entries.push({ index: i, boundingBox: this.takeBox().copy(box) });
          }
        }
      }

      this.rebuild(entries);
      for (const entry of entries) {
        if (!this.pendingUpdates.has(entry.index)) {
          this.spareBoxes.push(entry.boundingBox);
        }
      }
    } else {
      // Apply updates individually
      for (const [index, box] of this.pendingUpdates) {
        if (box === null) {
          this.removeInstance(index);
        } else {
          this.addOrUpdateInstance(index, box);
        }
      }
    }

    for (const box of this.pendingUpdates.values()) {
      if (box) this.spareBoxes.push(box);
    }
    this.pendingUpdates.clear();
  }

  /** Rebuild the entire BVH from a list of entries. Much faster than individual insertions for bulk updates. */
  rebuild(entries: { index: number; boundingBox: Box3 }[]): void {
    // Clear existing state
    this.nodes.length = 0;
    this.root = -1;
    this.freeList = -1;
    this.map = [];
    this.count = entries.length;

    if (entries.length === 0) return;

    // The tree is empty, so leaves take node ids 0..n-1 and index `centres`
    const leaves = new Int32Array(entries.length);
    const centres = new Float64Array(entries.length * 3);
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const leaf = this.allocateNode();
      const node = this.nodes[leaf];
      node.box.copy(entry.boundingBox);
      node.index = entry.index;
      node.left = -1;
      node.right = -1;
      node.height = 0;
      this.map[entry.index] = leaf;
      leaves[i] = leaf;
      node.box.getCenter(centreVec).toArray(centres, leaf * 3);
    }

    // Build tree top-down using median split
    this.root = this.buildTopDown(leaves, centres);
  }

  private buildTopDown(leaves: Int32Array, centres: Float64Array): number {
    if (leaves.length === 0) return -1;
    if (leaves.length === 1) return leaves[0];

    // Compute combined bounding box
    combinedBox.makeEmpty();
    for (const leaf of leaves) combinedBox.union(this.nodes[leaf].box);

    // Find longest axis (0 = x, 1 = y, 2 = z)
    const size = combinedBox.getSize(sizeVec);
    const axis = size.x > size.y
      ? (size.x > size.z ? 0 : 2)
      : (size.y > size.z ? 1 : 2);

    // Sort by center along axis
    leaves.sort((a, b) => centres[a * 3 + axis] - centres[b * 3 + axis]);

    // Split at median
    const mid = Math.floor(leaves.length / 2);
    const left = this.buildTopDown(leaves.subarray(0, mid), centres);
    const right = this.buildTopDown(leaves.subarray(mid), centres);

    // Create parent node
    const parent = this.allocateNode();
    const node = this.nodes[parent];
    node.left = left;
    node.right = right;

    if (left !== -1) this.nodes[left].parent = parent;
    if (right !== -1) this.nodes[right].parent = parent;

    // Compute height and bounding box
    const leftHeight = left !== -1 ? this.nodes[left].height : 0;
    const rightHeight = right !== -1 ? this.nodes[right].height : 0;
    node.height = 1 + Math.max(leftHeight, rightHeight);

    const leftBox = left !== -1 ? this.nodes[left].box : null;
    const rightBox = right !== -1 ? this.nodes[right].box : null;
    if (leftBox && rightBox) node.box.copy(leftBox).union(rightBox);
    else if (leftBox) node.box.copy(leftBox);
    else if (rightBox) node.box.copy(rightBox);

    return parent;
  }

  addOrUpdateInstance(index: number, boundingBox: Box3): void {
    // If this instance already exists, remove it first
    // (In a production system, you'd track which node belongs to which index.)
    const existingNode = this.map[index] ?? -1;
    if (existingNode !== -1) {
      this.removeInstance(index);
    }
    this.count++;

    // Add a new leaf node
    const leaf = this.allocateNode();
    const node = this.nodes[leaf];
    this.map[index] = leaf;
    node.box.copy(boundingBox);
    node.index = index;
    node.left = -1;
    node.right = -1;
    node.height = 0;

    this.insertLeaf(leaf);
  }

  removeInstance(index: number): void {
    const leaf = this.map[index] ?? -1;
    if (leaf === -1) return;

    this.removeLeaf(leaf);
    this.freeNode(leaf);
    delete this.map[index];
    this.count--;
  }

  // Raycast returns a list of candidate instances whose bounding boxes intersect the ray
  raycast(ray: Ray): number[] {
    const stack: number[] = [];
    const results: number[] = [];

    if (this.root === -1) return results;
    stack.push(this.root);

    while (stack.length > 0) {
      const nodeID = stack.pop()!;
      if (nodeID === -1) continue;
      const node = this.nodes[nodeID];

      if (!this.rayIntersectsBox(ray, node.box)) continue;

      if (node.left === -1 && node.right === -1) {
        // Leaf node
        results.push(node.index);
      } else {
        if (node.left !== -1) stack.push(node.left);
        if (node.right !== -1) stack.push(node.right);
      }
    }

    return results;
  }

  // ---- Internal methods ----

  private allocateNode(): number {
    if (this.freeList === -1) {
      const node: BVHNode = {
        parent: -1,
        left: -1,
        right: -1,
        height: -1,
        box: new Box3(),
        index: -1,
      };
      this.nodes.push(node);
      return this.nodes.length - 1;
    } else {
      const nodeID = this.freeList;
      this.freeList = this.nodes[nodeID].parent; // use parent as next free
      const node = this.nodes[nodeID];
      node.parent = -1;
      node.left = -1;
      node.right = -1;
      node.height = -1;
      node.index = -1;
      node.box.makeEmpty();
      return nodeID;
    }
  }

  private freeNode(nodeID: number) {
    this.nodes[nodeID].parent = this.freeList;
    this.freeList = nodeID;
  }

  private insertLeaf(leaf: number) {
    if (this.root === -1) {
      this.root = leaf;
      // this.nodes[this.root].parent = -1; // Shouldn't be required since it starts as -1
      return;
    }

    // Find the best sibling for the leaf
    const leafBox = this.nodes[leaf].box;
    let index = this.root;

    while (!this.isLeaf(index)) {
      const node = this.nodes[index];
      const oldArea = this.surfaceArea(node.box);
      const newArea = this.surfaceArea(
        combinedBox.copy(node.box).union(leafBox),
      );

      // Cost of creating a new parent for this node and the new leaf
      const cost = 2 * newArea;

      // Minimum cost of pushing the leaf down the tree
      const inheritanceCost = 2 * (newArea - oldArea);

      let costLeft = 0;
      let costRight = 0;

      if (node.left !== -1) {
        const leftBox = this.nodes[node.left].box;
        const newLeft = childBox.copy(leftBox).union(leafBox);
        costLeft = this.surfaceArea(newLeft) - this.surfaceArea(leftBox) +
          inheritanceCost;
      } else {
        costLeft = this.surfaceArea(leafBox) + inheritanceCost;
      }

      if (node.right !== -1) {
        const rightBox = this.nodes[node.right].box;
        const newRight = childBox.copy(rightBox).union(leafBox);
        costRight = this.surfaceArea(newRight) - this.surfaceArea(rightBox) +
          inheritanceCost;
      } else {
        costRight = this.surfaceArea(leafBox) + inheritanceCost;
      }

      // Descend according to the minimum cost
      if (cost < costLeft && cost < costRight) {
        break;
      }

      if (costLeft < costRight) {
        index = node.left;
      } else {
        index = node.right;
      }
    }

    const sibling = index;
    const oldParent = this.nodes[sibling].parent;
    const newParent = this.allocateNode();
    this.nodes[newParent].parent = oldParent;
    this.nodes[newParent].box.copy(this.nodes[sibling].box).union(
      this.nodes[leaf].box,
    );
    this.nodes[newParent].height = this.nodes[sibling].height + 1;

    if (oldParent === -1) {
      this.root = newParent;
    } else {
      if (this.nodes[oldParent].left === sibling) {
        this.nodes[oldParent].left = newParent;
      } else {
        this.nodes[oldParent].right = newParent;
      }
    }

    this.nodes[newParent].left = sibling;
    this.nodes[newParent].right = leaf;
    this.nodes[sibling].parent = newParent;
    this.nodes[leaf].parent = newParent;

    this.balanceUpwards(leaf);
  }

  private removeLeaf(leaf: number) {
    if (leaf === this.root) {
      this.root = -1;
      return;
    }
    const parent = this.nodes[leaf].parent;
    if (parent === -1) return;
    const grandParent = this.nodes[parent].parent;
    let sibling: number;
    if (this.nodes[parent].left === leaf) {
      sibling = this.nodes[parent].right;
    } else {
      sibling = this.nodes[parent].left;
    }

    // Handle case where sibling is -1
    if (sibling === -1) {
      // If the parent node is invalid, reset the root or throw an error
      if (grandParent === -1) {
        // Parent is root, and sibling is missing
        this.root = -1;
      } else {
        // Remove the parent and update the grandparent's child
        if (this.nodes[grandParent].left === parent) {
          this.nodes[grandParent].left = -1;
        } else {
          this.nodes[grandParent].right = -1;
        }
        this.freeNode(parent);
        this.balanceUpwards(grandParent);
      }
      return;
    }

    if (grandParent !== -1) {
      if (this.nodes[grandParent].left === parent) {
        this.nodes[grandParent].left = sibling;
      } else {
        this.nodes[grandParent].right = sibling;
      }
      this.nodes[sibling].parent = grandParent;
      this.freeNode(parent);
      this.balanceUpwards(grandParent);
    } else {
      this.root = sibling;
      this.nodes[sibling].parent = -1;
      this.freeNode(parent);
    }
  }

  private balanceUpwards(start: number) {
    let index = start;
    while (index !== -1) {
      index = this.balance(index);

      const node = this.nodes[index];
      const left = node.left;
      const right = node.right;

      node.height = 1 + Math.max(
        left !== -1 ? this.nodes[left].height : 0,
        right !== -1 ? this.nodes[right].height : 0,
      );

      const leftBox = (left !== -1) ? this.nodes[left].box : null;
      const rightBox = (right !== -1) ? this.nodes[right].box : null;

      if (leftBox && rightBox) node.box.copy(leftBox).union(rightBox);
      else if (leftBox) node.box.copy(leftBox);
      else if (rightBox) node.box.copy(rightBox);

      index = node.parent;
    }
  }

  // A simple rotation-based balancing (not fully optimized)
  private balance(iA: number): number {
    const A = this.nodes[iA];
    if (this.isLeaf(iA) || A.height < 2 || A.left === -1 || A.right === -1) {
      return iA;
    }

    const iB = A.left;
    const iC = A.right;
    const B = this.nodes[iB];
    const C = this.nodes[iC];

    const balance = C.height - B.height;

    // Rotate
    if (balance > 1) {
      // Rotate C up
      const iF = C.left;
      const iG = C.right;
      const F = this.nodes[iF];
      const G = this.nodes[iG];

      // Swap parent
      C.left = iA;
      C.parent = A.parent;
      A.parent = iC;

      // Update parent link
      if (C.parent !== -1) {
        if (this.nodes[C.parent].left === iA) {
          this.nodes[C.parent].left = iC;
        } else {
          this.nodes[C.parent].right = iC;
        }
      } else {
        this.root = iC;
      }

      // Rotate
      if (F.height > G.height) {
        C.right = iF;
        A.right = iG;
        G.parent = iA;
        A.box.copy(B.box).union(G.box);
        C.box.copy(A.box).union(F.box);
        A.height = 1 + Math.max(B.height, G.height);
        C.height = 1 + Math.max(A.height, F.height);
      } else {
        C.right = iG;
        A.right = iF;
        F.parent = iA;
        A.box.copy(B.box).union(F.box);
        C.box.copy(A.box).union(G.box);
        A.height = 1 + Math.max(B.height, F.height);
        C.height = 1 + Math.max(A.height, G.height);
      }

      return iC;
    }

    if (balance < -1) {
      // Rotate B up
      const iD = B.left;
      const iE = B.right;
      const D = this.nodes[iD];
      const E = this.nodes[iE];

      B.left = iA;
      B.parent = A.parent;
      A.parent = iB;

      if (B.parent !== -1) {
        if (this.nodes[B.parent].left === iA) {
          this.nodes[B.parent].left = iB;
        } else {
          this.nodes[B.parent].right = iB;
        }
      } else {
        this.root = iB;
      }

      if (D.height > E.height) {
        B.right = iD;
        A.left = iE;
        E.parent = iA;
        A.box.copy(C.box).union(E.box);
        B.box.copy(A.box).union(D.box);
        A.height = 1 + Math.max(C.height, E.height);
        B.height = 1 + Math.max(A.height, D.height);
      } else {
        B.right = iE;
        A.left = iD;
        D.parent = iA;
        A.box.copy(C.box).union(D.box);
        B.box.copy(A.box).union(E.box);
        A.height = 1 + Math.max(C.height, D.height);
        B.height = 1 + Math.max(A.height, E.height);
      }

      return iB;
    }

    return iA;
  }

  private surfaceArea(box: Box3): number {
    box.getSize(sizeVec);
    return 2 *
      (sizeVec.x * sizeVec.y + sizeVec.y * sizeVec.z +
        sizeVec.z * sizeVec.x);
  }

  private isLeaf(i: number): boolean {
    if (i === -1) return false;
    const node = this.nodes[i];
    return node.left === -1 && node.right === -1;
  }

  private rayIntersectsBox(ray: Ray, box: Box3): boolean {
    // Utilize Three.js Ray/Box intersection method
    return ray.intersectBox(box, tempVec) !== null;
  }
}
