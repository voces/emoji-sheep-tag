import type { Material, Object3D } from "three";

const drawsWithMaterial = (
  object: Object3D,
): object is Object3D & { material: Material | Material[] } =>
  "material" in object && !!object.material;

/**
 * Tracks whether anything under `roots` draws with a material whose program
 * has not been sent to compile, by watching objects join the scene graph
 * rather than walking it every frame. Starts out needing a compile.
 */
export const watchForUncompiled = (roots: Object3D[]) => {
  const compiled = new WeakSet<Material>();
  const isCompiled = (material: Material) => compiled.has(material);
  let pending = true;

  const hasUncompiled = (root: Object3D) => {
    const stack: Object3D[] = [root];
    for (let object = stack.pop(); object; object = stack.pop()) {
      if (drawsWithMaterial(object)) {
        const { material } = object;
        if (
          Array.isArray(material)
            ? !material.every(isCompiled)
            : !isCompiled(material)
        ) return true;
      }
      for (let i = 0; i < object.children.length; i++) {
        stack.push(object.children[i]);
      }
    }
    return false;
  };

  const onChildAdded = ({ child }: { child: Object3D }) => {
    watch(child);
    if (!pending && hasUncompiled(child)) pending = true;
  };
  const watch = (root: Object3D) =>
    root.traverse((object) =>
      object.addEventListener("childadded", onChildAdded)
    );
  roots.forEach(watch);

  return {
    needsCompile: () => pending,
    /** Records every material under the roots as sent to compile. */
    markCompiled: () => {
      pending = false;
      for (const root of roots) {
        root.traverse((object) => {
          if (!drawsWithMaterial(object)) return;
          for (const material of [object.material].flat()) {
            compiled.add(material);
          }
        });
      }
    },
  };
};
