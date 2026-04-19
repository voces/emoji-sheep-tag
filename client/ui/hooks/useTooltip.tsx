import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { styled } from "styled-components";

const Tooltip = styled.div`
  position: fixed;
  max-width: 400px;
  background: ${({ theme }) => theme.surface.scrim};
  backdrop-filter: blur(12px);
  border: 1px solid ${({ theme }) => theme.border.soft};
  border-radius: ${({ theme }) => theme.radius.sm};
  box-shadow: ${({ theme }) => theme.shadow.md};
  padding: ${({ theme }) => theme.space[2]} ${({ theme }) => theme.space[3]};
  font-size: ${({ theme }) => theme.text.sm};
  color: ${({ theme }) => theme.ink.mid};
  line-height: 1.4;
  pointer-events: none;
  z-index: 9999;
`;

type TooltipPosition = {
  top?: number;
  bottom?: number;
  left?: number;
  right?: number;
  opacity?: number;
};

const calculatePosition = (
  containerRect: DOMRect,
  tooltipWidth: number,
): TooltipPosition => {
  const position: TooltipPosition = {};

  const viewportWidth = globalThis.innerWidth;
  const containerCenterX = containerRect.left + containerRect.width / 2;
  if (containerCenterX < viewportWidth / 2) {
    const left = containerCenterX - tooltipWidth / 2;
    position.left = left < 0 ? 0 : left;
  } else {
    const right = viewportWidth - containerCenterX - tooltipWidth / 2;
    position.right = right < 0 ? 0 : right;
  }

  const viewportHeight = globalThis.innerHeight;
  const containerCenterY = containerRect.top + containerRect.height / 2;
  if (containerCenterY < viewportHeight / 2) {
    position.top = containerRect.bottom + 6;
  } else {
    position.bottom = viewportHeight - containerRect.top + 6;
  }

  return position;
};

export const useTooltip = <T extends HTMLElement = HTMLDivElement>(
  tooltip: React.ReactNode,
) => {
  const containerRef = useRef<T>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const [coords, setCoords] = useState<TooltipPosition | null>(null);

  const onMouseEnter = useCallback(() => {
    if (!containerRef.current) return;
    const containerRect = containerRef.current.getBoundingClientRect();
    const tooltipWidth = tooltipRef.current?.offsetWidth || 200;
    const position = calculatePosition(containerRect, tooltipWidth);

    if (!tooltipRef.current) position.opacity = 0;

    setCoords(position);
  }, []);

  // Recalculate position after tooltip is rendered to get accurate dimensions
  useLayoutEffect(() => {
    if (coords?.opacity !== 0 || !tooltipRef.current || !containerRef.current) {
      return;
    }

    const containerRect = containerRef.current.getBoundingClientRect();
    const tooltipWidth = tooltipRef.current.offsetWidth;
    const position = calculatePosition(containerRect, tooltipWidth);

    setCoords(position);
  }, [coords]);

  const onMouseLeave = useCallback(() => setCoords(null), []);

  const clearTooltip = useCallback(() => setCoords(null), []);

  useEffect(() => () => setCoords(null), [clearTooltip]);

  return useMemo(
    () => ({
      tooltipContainerProps: { onMouseEnter, onMouseLeave, ref: containerRef },
      tooltip: coords && tooltip
        ? createPortal(
          <Tooltip role="tooltip" style={coords} ref={tooltipRef}>
            {tooltip}
          </Tooltip>,
          document.body,
        )
        : null,
    }),
    [onMouseEnter, onMouseLeave, coords, tooltip],
  );
};
