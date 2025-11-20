import { assertEquals } from "@std/assert";
import { InstancedGroup } from "./InstancedGroup.ts";
import {
  BoxGeometry,
  Group,
  InstancedMesh,
  Mesh,
  MeshBasicMaterial,
} from "three";

Deno.test("InstancedGroup bounding box excludes infinite instances", () => {
  // Create a simple mesh
  const geometry = new BoxGeometry(1, 1, 1);
  const material = new MeshBasicMaterial({ color: 0xff0000 });
  const mesh = new Mesh(geometry, material);
  const group = new Group();
  group.add(mesh);

  // Create InstancedGroup with 10 instances
  const instancedGroup = new InstancedGroup(group, 10, "test");

  // By default, all instances are at Infinity
  // Add a few instances at finite positions
  instancedGroup.setPositionAt(0, 5, 5, 0, 0);
  instancedGroup.setPositionAt(1, 10, 10, 0, 0);
  instancedGroup.setPositionAt(2, 15, 15, 0, 0);
  // Instances 3-9 remain at Infinity

  // Compute bounding box
  for (const child of instancedGroup.children) {
    if (child instanceof InstancedMesh) {
      child.computeBoundingBox();
      const bbox = child.boundingBox;

      console.log("Bounding box:", bbox);

      // Verify bounding box is finite
      assertEquals(
        Number.isFinite(bbox!.min.x),
        true,
        "min.x should be finite",
      );
      assertEquals(
        Number.isFinite(bbox!.min.y),
        true,
        "min.y should be finite",
      );
      assertEquals(
        Number.isFinite(bbox!.max.x),
        true,
        "max.x should be finite",
      );
      assertEquals(
        Number.isFinite(bbox!.max.y),
        true,
        "max.y should be finite",
      );

      // Verify bounding box roughly covers the 3 finite instances
      // With BoxGeometry(1,1,1), instances at 5,5 to 15,15 should give roughly:
      // min: ~4.5, max: ~15.5 (accounting for box size)
      const width = bbox!.max.x - bbox!.min.x;
      const height = bbox!.max.y - bbox!.min.y;

      console.log(`Width: ${width}, Height: ${height}`);

      // Width and height should be finite and reasonable (roughly 11-12 units)
      assertEquals(Number.isFinite(width), true, "width should be finite");
      assertEquals(Number.isFinite(height), true, "height should be finite");
      assertEquals(width > 0, true, "width should be positive");
      assertEquals(height > 0, true, "height should be positive");
      assertEquals(width < 20, true, "width should be reasonable (< 20)");
      assertEquals(height < 20, true, "height should be reasonable (< 20)");
    }
  }
});

Deno.test("InstancedGroup bounding sphere excludes infinite instances", () => {
  // Create a simple mesh
  const geometry = new BoxGeometry(1, 1, 1);
  const material = new MeshBasicMaterial({ color: 0xff0000 });
  const mesh = new Mesh(geometry, material);
  const group = new Group();
  group.add(mesh);

  // Create InstancedGroup with 10 instances
  const instancedGroup = new InstancedGroup(group, 10, "test");

  // Add finite instances
  instancedGroup.setPositionAt(0, 5, 5, 0, 0);
  instancedGroup.setPositionAt(1, 10, 10, 0, 0);

  // Compute bounding sphere
  for (const child of instancedGroup.children) {
    if (child instanceof InstancedMesh) {
      child.computeBoundingSphere();
      const sphere = child.boundingSphere;

      console.log("Bounding sphere:", sphere);

      // Verify bounding sphere is finite
      assertEquals(
        Number.isFinite(sphere!.center.x),
        true,
        "center.x should be finite",
      );
      assertEquals(
        Number.isFinite(sphere!.center.y),
        true,
        "center.y should be finite",
      );
      assertEquals(
        Number.isFinite(sphere!.radius),
        true,
        "radius should be finite",
      );
      assertEquals(sphere!.radius > 0, true, "radius should be positive");
      assertEquals(
        sphere!.radius < 20,
        true,
        "radius should be reasonable (< 20)",
      );
    }
  }
});
