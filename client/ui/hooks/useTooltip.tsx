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
  background-color: ${({ theme }) => theme.colors.background};
  box-shadow: ${({ theme }) => theme.colors.shadow} 1px 1px 4px 1px;
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) =>
    theme.spacing.md};
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
    position.top = containerRect.bottom + 16;
  } else {
    position.bottom = viewportHeight - containerRect.top + 16;
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
  }, [containerRef.current]);

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
