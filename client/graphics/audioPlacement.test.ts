import { expect } from "@std/expect";
import { it } from "@std/testing/bdd";
import { Object3D } from "three";
import { placeOnlyWhenMoved } from "./audioPlacement.ts";

it("tells where a sound is only when it has moved, however often it renders", () => {
  const sound = new Object3D();
  let told = 0;
  sound.updateMatrixWorld = function (force?: boolean) {
    Object3D.prototype.updateMatrixWorld.call(this, force);
    told++;
  };
  placeOnlyWhenMoved(sound);

  sound.updateMatrixWorld();
  sound.updateMatrixWorld();
  sound.updateMatrixWorld();
  expect(told).toBe(1);

  sound.position.set(3, 4, 0);
  sound.updateMatrixWorld();
  sound.updateMatrixWorld();
  expect(told).toBe(2);
});
