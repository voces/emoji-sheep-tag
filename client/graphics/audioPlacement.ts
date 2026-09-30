import {
  type AudioListener,
  Matrix4,
  Object3D,
  Quaternion,
  Vector3,
} from "three";

/**
 * three's audio objects tell Web Audio where they are whenever their matrices
 * update, and the camera the listener rides on updates on every render, several
 * times a frame: each time queuing another ramp on every position and direction
 * parameter. These tell it only when they have moved.
 */

/**
 * Makes `object` tell where it is, by `place`, only once it has moved; by
 * default by passing on the matrix update as three would.
 */
export const placeOnlyWhenMoved = <T extends Object3D>(
  object: T,
  place: (force?: boolean) => void = object.updateMatrixWorld.bind(object),
): T => {
  const placed = new Matrix4();
  let everPlaced = false;
  object.updateMatrixWorld = (force?: boolean) => {
    Object3D.prototype.updateMatrixWorld.call(object, force);
    if (everPlaced && object.matrixWorld.equals(placed)) return;
    everPlaced = true;
    placed.copy(object.matrixWorld);
    place(force);
  };
  return object;
};

/** How long, in seconds, the listener glides to where it has moved. */
const LISTENER_GLIDE = 1 / 60;

const position = new Vector3();
const quaternion = new Quaternion();
const scale = new Vector3();
const forward = new Vector3();
const up = new Vector3();

/**
 * Places `listener` only when it has moved, gliding briefly rather than over
 * however long it last stood still, as three's own timing would.
 */
export const placeListenerWhenMoved = (listener: AudioListener) =>
  placeOnlyWhenMoved(listener, () => {
    listener.matrixWorld.decompose(position, quaternion, scale);
    forward.set(0, 0, -1).applyQuaternion(quaternion);
    up.set(0, 1, 0).applyQuaternion(quaternion);
    const target = listener.context.listener;
    if (!target.positionX) {
      target.setPosition(position.x, position.y, position.z);
      target.setOrientation(forward.x, forward.y, forward.z, up.x, up.y, up.z);
      return;
    }
    const end = listener.context.currentTime + LISTENER_GLIDE;
    target.positionX.linearRampToValueAtTime(position.x, end);
    target.positionY.linearRampToValueAtTime(position.y, end);
    target.positionZ.linearRampToValueAtTime(position.z, end);
    target.forwardX.linearRampToValueAtTime(forward.x, end);
    target.forwardY.linearRampToValueAtTime(forward.y, end);
    target.forwardZ.linearRampToValueAtTime(forward.z, end);
    target.upX.linearRampToValueAtTime(up.x, end);
    target.upY.linearRampToValueAtTime(up.y, end);
    target.upZ.linearRampToValueAtTime(up.z, end);
  });
