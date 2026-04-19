import { useEffect, useRef, useState } from "react";
import { styled } from "styled-components";
import { Vector3 } from "three";
import { mouse } from "../../../mouse.ts";
import { Entity } from "../../../ecs.ts";
import { getPlayer } from "@/shared/api/player.ts";
import { camera } from "../../../graphics/three.ts";
import { getBlueprint } from "../../../controls/blueprintHandlers.ts";
import { getActiveOrder } from "../../../controls/orderHandlers.ts";

const HOVER_DELAY_MS = 500;

const Tooltip = styled.div`
  position: fixed;
  background: ${({ theme }) => theme.surface.scrim};
  backdrop-filter: blur(12px);
  border: 1px solid ${({ theme }) => theme.border.soft};
  border-radius: ${({ theme }) => theme.radius.sm};
  box-shadow: ${({ theme }) => theme.shadow.md};
  padding: ${({ theme }) => theme.space[1]} ${({ theme }) => theme.space[2]};
  font-size: ${({ theme }) => theme.text.sm};
  white-space: nowrap;
  pointer-events: none;
  z-index: 9999;
  transform: translate(-50%, calc(-100% - ${({ theme }) => theme.space[6]}));
`;

const OwnerName = styled.span<{ $color: string }>`
  color: ${({ $color }) => $color};
`;

const TrueOwner = styled.span`
  color: ${({ theme }) => theme.ink.lo};
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
  const [screenPos, setScreenPos] = useState<{ x: number; y: number } | null>(
    null,
  );
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
        setScreenPos(null);

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
    let lastX = 0;
    let lastY = 0;
    const interval = setInterval(() => {
      updateTooltipState();
      const entity = currentEntityRef.current;
      if (entity) {
        const pos = worldToScreen(entity);
        if (
          pos && (Math.abs(pos.x - lastX) > 1 || Math.abs(pos.y - lastY) > 1)
        ) {
          lastX = pos.x;
          lastY = pos.y;
          setScreenPos(pos);
        }
      }
    }, 200);

    return () => {
      mouse.removeEventListener("intersectsChange", updateTooltipState);
      clearInterval(interval);
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    };
  }, []);

  if (!visibleEntity || !screenPos) return null;

  const ownerInfo = getOwnerDisplay(visibleEntity);
  if (!ownerInfo) return null;

  const { owner, trueOwner } = ownerInfo;

  return (
    <Tooltip style={{ left: screenPos.x, top: screenPos.y }}>
      <OwnerName $color={owner.playerColor ?? "inherit"}>
        {owner.name}
      </OwnerName>
      {trueOwner && (
        <TrueOwner>
          {" "}
          (<OwnerName $color={trueOwner.playerColor ?? "inherit"}>
            {trueOwner.name}
          </OwnerName>)
        </TrueOwner>
      )}
    </Tooltip>
  );
};
