import { useCallback, useEffect, useRef } from "react";
import { Vector2 } from "three";
import { Entity } from "../../ecs.ts";
import { mouse } from "../../mouse.ts";
import {
  getActiveOrder,
  handleTargetOrder,
  rejectAction,
} from "../../controls/orderHandlers.ts";
import { isQueueModifierHeld } from "../../controls/keyboardHandlers.ts";
import { startFollowingEntity, stopFollowingEntity } from "../../api/camera.ts";
import { ExtendedSet } from "@/shared/util/ExtendedSet.ts";
import { selectionFocusVar } from "@/vars/selectionFocus.ts";

/**
 * Click handler for an entity's portrait: with a target order armed it casts
 * the order on the entity, otherwise the camera follows the entity until the
 * mouse button is released. `focus` also makes the entity the selection focus.
 */
export const useTargetOrFollow = (
  entity: Entity | undefined,
  { focus = false }: { focus?: boolean } = {},
) => {
  const startedFollowingRef = useRef(false);

  useEffect(() => {
    const handleMouseUp = () => {
      if (!startedFollowingRef.current) return;
      stopFollowingEntity();
      startedFollowingRef.current = false;
    };

    mouse.addEventListener("mouseButtonUp", handleMouseUp);
    return () => mouse.removeEventListener("mouseButtonUp", handleMouseUp);
  }, []);

  return useCallback(() => {
    if (getActiveOrder() && entity) {
      const result = handleTargetOrder({
        intersects: new ExtendedSet([entity]),
        world: new Vector2(entity.position?.x ?? 0, entity.position?.y ?? 0),
        queue: isQueueModifierHeld(),
      });
      if (!result.success) rejectAction();
      return;
    }
    if (focus && entity) selectionFocusVar(entity);
    startFollowingEntity(entity);
    startedFollowingRef.current = true;
  }, [entity, focus]);
};
