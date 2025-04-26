import { Box3, Ray, Vector3 } from "three";

interface BVHNode {
  parent: number;
  left: number;
  right: number;
  height: number;
  box: Box3;
  index: number; // only valid if leaf
}

export class BVH {
  private nodes: BVHNode[] = [];
  private root: number = -1;
  private freeList: number = -1;
  private map: number[] = [];

  constructor() {
    // Pre-allocate some nodes if desired, or grow dynamically
  }

  addOrUpdateInstance(index: number, boundingBox: Box3): void {
    // If this instance already exists, remove it first
    // (In a production system, you'd track which node belongs to which index.)
    const existingNode = this.map[index] ?? -1;
    if (existingNode !== -1) {
      this.removeInstance(index);
    }

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
      let parent = -1;
      const bvh = this;
      const node: BVHNode = {
        set parent(value: number) {
          parent = value;
          const set = new Set<BVHNode>([this]);
          let cur = this;
          if (value === -1) return;
          while (cur.parent !== -1) {
            const next = bvh.nodes[cur.parent];
            set.add(next);
            cur = next;
          }
        },
        get parent() {
          return parent;
        },
        // parent: ,
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
      const combined = this.unionBoxes(node.box, leafBox);

      const oldArea = this.surfaceArea(node.box);
      const newArea = this.surfaceArea(combined);

      // Cost of creating a new parent for this node and the new leaf
      const cost = 2 * newArea;

      // Minimum cost of pushing the leaf down the tree
      const inheritanceCost = 2 * (newArea - oldArea);

      let costLeft = 0;
      let costRight = 0;

      if (node.left !== -1) {
        const leftBox = this.nodes[node.left].box;
        const newLeft = this.unionBoxes(leftBox, leafBox);
        costLeft = this.surfaceArea(newLeft) - this.surfaceArea(leftBox) +
          inheritanceCost;
      } else {
        costLeft = this.surfaceArea(leafBox) + inheritanceCost;
      }

      if (node.right !== -1) {
        const rightBox = this.nodes[node.right].box;
        const newRight = this.unionBoxes(rightBox, leafBox);
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
    this.nodes[newParent].box = this.unionBoxes(
      this.nodes[sibling].box,
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

      if (leftBox && rightBox) {
        node.box = this.unionBoxes(leftBox, rightBox);
      } else if (leftBox) {
        node.box = leftBox.clone();
      } else if (rightBox) {
        node.box = rightBox.clone();
      }

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
        A.box = this.unionBoxes(B.box, G.box);
        C.box = this.unionBoxes(A.box, F.box);
        A.height = 1 + Math.max(B.height, G.height);
        C.height = 1 + Math.max(A.height, F.height);
      } else {
        C.right = iG;
        A.right = iF;
        F.parent = iA;
        A.box = this.unionBoxes(B.box, F.box);
        C.box = this.unionBoxes(A.box, G.box);
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
        A.box = this.unionBoxes(C.box, E.box);
        B.box = this.unionBoxes(A.box, D.box);
        A.height = 1 + Math.max(C.height, E.height);
        B.height = 1 + Math.max(A.height, D.height);
      } else {
        B.right = iE;
        A.left = iD;
        D.parent = iA;
        A.box = this.unionBoxes(C.box, D.box);
        B.box = this.unionBoxes(A.box, E.box);
        A.height = 1 + Math.max(C.height, D.height);
        B.height = 1 + Math.max(A.height, E.height);
      }

      return iB;
    }

    return iA;
  }

  private surfaceArea(box: Box3): number {
    const size = new Vector3();
    box.getSize(size);
    return 2 * (size.x * size.y + size.y * size.z + size.z * size.x);
  }

  private unionBoxes(a: Box3, b: Box3): Box3 {
    return new Box3(
      new Vector3(
        Math.min(a.min.x, b.min.x),
        Math.min(a.min.y, b.min.y),
        Math.min(a.min.z, b.min.z),
      ),
      new Vector3(
        Math.max(a.max.x, b.max.x),
        Math.max(a.max.y, b.max.y),
        Math.max(a.max.z, b.max.z),
      ),
    );
  }

  private isLeaf(i: number): boolean {
    if (i === -1) return false;
    const node = this.nodes[i];
    return node.left === -1 && node.right === -1;
  }

  private rayIntersectsBox(ray: Ray, box: Box3): boolean {
    // Utilize Three.js Ray/Box intersection method
    return ray.intersectBox(box, new Vector3()) !== null;
  }
}
