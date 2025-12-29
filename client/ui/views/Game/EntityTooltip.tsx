import { useEffect, useRef, useState } from "react";
import { styled } from "styled-components";
import { Vector3 } from "three";
import { mouse } from "../../../mouse.ts";
import { Entity } from "../../../ecs.ts";
import { getPlayer } from "@/shared/api/player.ts";
import { camera } from "../../../graphics/three.ts";
import { getBlueprint } from "../../../controls/blueprintHandlers.ts";
import { getActiveOrder } from "../../../controls.ts";

const HOVER_DELAY_MS = 500;

const Tooltip = styled.div`
  position: fixed;
  background-color: ${({ theme }) => theme.colors.background};
  box-shadow: ${({ theme }) => theme.colors.shadow} 1px 1px 4px 1px;
  padding: 0 ${({ theme }) => theme.spacing.md};
  white-space: nowrap;
  pointer-events: none;
  z-index: 9999;
  transform: translate(-50%, calc(-100% - 24px));
`;

const OwnerName = styled.span<{ $color: string }>`
  color: ${({ $color }) => $color};
`;

const TrueOwner = styled.span`
  opacity: 0.7;
`;

const getOwnerDisplay = (entity: Entity) => {
  if (!entity.owner) return null;

  const owner = getPlayer(entity.owner);
  if (!owner) return null;

  const trueOwner = entity.trueOwner && entity.trueOwner !== entity.owner
    ? getPlayer(entity.trueOwner)
    : null;

  return { owner, trueOwner };
};

const worldToScreen = (entity: Entity): { x: number; y: number } | null => {
  if (!entity.position) return null;

  const pos = new Vector3(entity.position.x, entity.position.y, 0);
  pos.project(camera);

  return {
    x: (pos.x + 1) / 2 * globalThis.innerWidth,
    y: (-pos.y + 1) / 2 * globalThis.innerHeight,
  };
};

export const EntityTooltip = () => {
  const [visibleEntity, setVisibleEntity] = useState<Entity | null>(null);
  const [, forceUpdate] = useState(0);
  const hoverTimerRef = useRef<number | null>(null);
  const currentEntityRef = useRef<Entity | null>(null);

  useEffect(() => {
    const updateTooltipState = () => {
      // Suppress tooltip when cursor is being used
      if (getBlueprint() || getActiveOrder()) {
        if (currentEntityRef.current !== null) {
          currentEntityRef.current = null;
          setVisibleEntity(null);
          if (hoverTimerRef.current) {
            clearTimeout(hoverTimerRef.current);
            hoverTimerRef.current = null;
          }
        }
        return;
      }

      const firstEntity = mouse.intersects.first();
      const targetEntity = firstEntity?.owner ? firstEntity : null;

      // Entity changed - reset timer
      if (targetEntity !== currentEntityRef.current) {
        currentEntityRef.current = targetEntity;
        setVisibleEntity(null);

        if (hoverTimerRef.current) {
          clearTimeout(hoverTimerRef.current);
          hoverTimerRef.current = null;
        }

        if (targetEntity) {
          hoverTimerRef.current = setTimeout(() => {
            if (currentEntityRef.current === targetEntity) {
              setVisibleEntity(targetEntity);
            }
          }, HOVER_DELAY_MS);
        }
      }
    };

    // Update on intersects change
    mouse.addEventListener("intersectsChange", updateTooltipState);

    // Periodic update for position and suppression state changes
    const interval = setInterval(() => {
      updateTooltipState();
      forceUpdate((n) => n + 1);
    }, 200);

    return () => {
      mouse.removeEventListener("intersectsChange", updateTooltipState);
      clearInterval(interval);
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    };
  }, []);

  if (!visibleEntity) return null;

  const ownerInfo = getOwnerDisplay(visibleEntity);
  if (!ownerInfo) return null;

  const { owner, trueOwner } = ownerInfo;
  const screenPos = worldToScreen(visibleEntity);
  if (!screenPos) return null;

  return (
    <Tooltip style={{ left: screenPos.x, top: screenPos.y }}>
      <OwnerName $color={owner.playerColor ?? "#FFFFFF"}>
        {owner.name}
      </OwnerName>
      {trueOwner && (
        <TrueOwner>
          {" "}
          (<OwnerName $color={trueOwner.playerColor ?? "#FFFFFF"}>
            {trueOwner.name}
          </OwnerName>)
        </TrueOwner>
      )}
    </Tooltip>
  );
};
