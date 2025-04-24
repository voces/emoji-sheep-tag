//@deno-types="npm:@types/react"
import { useCallback, useMemo, useRef, useState } from "react";
// @deno-types="npm:@types/react-dom"
import { createPortal } from "npm:react-dom";

export const useTooltip = (tooltip: React.ReactNode) => {
  const containerRef = useRef<HTMLDivElement>(null);

  const [coords, setCoords] = useState<{ top: number; left: number } | null>(
    null,
  );

  const onMouseEnter = useCallback(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setCoords({ top: rect.top - 16, left: rect.left + rect.width / 2 });
  }, [containerRef.current]);

  const onMouseLeave = useCallback(() => setCoords(null), []);

  return useMemo(
    () => ({
      tooltipContainerProps: { onMouseEnter, onMouseLeave, ref: containerRef },
      tooltip: coords
        ? createPortal(
          <div
            className="tooltip"
            style={{ top: coords.top, left: coords.left }}
          >
            {tooltip}
          </div>,
          document.body,
        )
        : null,
    }),
    [onMouseEnter, coords],
  );
};
