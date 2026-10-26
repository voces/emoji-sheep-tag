import { InstancedSvg } from "./InstancedSvg.ts";
import { BoxGeometry, BufferAttribute, Color, MeshBasicMaterial } from "three";
import { assert, test } from "vitest";

const createTestGeometry = () => {
  const geometry = new BoxGeometry(1, 1, 1);
  const vertexCount = geometry.attributes.position.count;

  // Add required attributes
  const colors = new Float32Array(vertexCount * 3).fill(1);
  geometry.setAttribute("color", new BufferAttribute(colors, 3));

  const opacities = new Float32Array(vertexCount).fill(1);
  geometry.setAttribute("intrinsicOpacity", new BufferAttribute(opacities, 1));

  return geometry;
};

test("InstancedSvg bounding box excludes infinite instances", () => {
  const geometry = createTestGeometry();
  const material = new MeshBasicMaterial({ color: 0xff0000 });

  const instancedSvg = new InstancedSvg([geometry], material, 10, "test");

  // By default, all instances are at Infinity
  // Add a few instances at finite positions
  instancedSvg.setPositionAt(0, 5, 5, 0, 0);
  instancedSvg.setPositionAt(1, 10, 10, 0, 0);
  instancedSvg.setPositionAt(2, 15, 15, 0, 0);
  // Instances 3-9 remain at Infinity

  instancedSvg.computeBoundingBox();
  const bbox = instancedSvg.boundingBox;

  // Verify bounding box is finite
  assert.deepEqual(
    Number.isFinite(bbox!.min.x),
    true,
    "min.x should be finite",
  );
  assert.deepEqual(
    Number.isFinite(bbox!.min.y),
    true,
    "min.y should be finite",
  );
  assert.deepEqual(
    Number.isFinite(bbox!.max.x),
    true,
    "max.x should be finite",
  );
  assert.deepEqual(
    Number.isFinite(bbox!.max.y),
    true,
    "max.y should be finite",
  );

  // Verify bounding box roughly covers the 3 finite instances
  const width = bbox!.max.x - bbox!.min.x;
  const height = bbox!.max.y - bbox!.min.y;

  assert.deepEqual(Number.isFinite(width), true, "width should be finite");
  assert.deepEqual(Number.isFinite(height), true, "height should be finite");
  assert.deepEqual(width > 0, true, "width should be positive");
  assert.deepEqual(height > 0, true, "height should be positive");
  assert.deepEqual(width < 20, true, "width should be reasonable (< 20)");
  assert.deepEqual(height < 20, true, "height should be reasonable (< 20)");
});

test("InstancedSvg bounding sphere excludes infinite instances", () => {
  const geometry = createTestGeometry();
  const material = new MeshBasicMaterial({ color: 0xff0000 });

  const instancedSvg = new InstancedSvg([geometry], material, 10, "test");

  // Add finite instances
  instancedSvg.setPositionAt(0, 5, 5, 0, 0);
  instancedSvg.setPositionAt(1, 10, 10, 0, 0);

  instancedSvg.computeBoundingSphere();
  const sphere = instancedSvg.boundingSphere;

  // Verify bounding sphere is finite
  assert.deepEqual(
    Number.isFinite(sphere!.center.x),
    true,
    "center.x should be finite",
  );
  assert.deepEqual(
    Number.isFinite(sphere!.center.y),
    true,
    "center.y should be finite",
  );
  assert.deepEqual(
    Number.isFinite(sphere!.radius),
    true,
    "radius should be finite",
  );
  assert.deepEqual(sphere!.radius > 0, true, "radius should be positive");
  assert.deepEqual(
    sphere!.radius < 20,
    true,
    "radius should be reasonable (< 20)",
  );
});

test("InstancedSvg draws tinted or not with one program, so an unused one compiles what a tinted one draws with", () => {
  const unused = new InstancedSvg(
    [createTestGeometry()],
    new MeshBasicMaterial(),
    0,
    "test",
  );
  // three builds a separate program for instanced meshes with instance colours
  assert.deepEqual(unused.instanceColor !== null, true);

  const tinted = new InstancedSvg(
    [createTestGeometry()],
    new MeshBasicMaterial(),
    0,
    "test",
  );
  tinted.setPositionAt("a", 0, 0);
  tinted.setVertexColorAt("a", new Color(1, 0, 0));
  assert.deepEqual(tinted.instanceColor?.getX(0), 1);
  assert.deepEqual(tinted.instanceColor?.getY(0), 0);
});
