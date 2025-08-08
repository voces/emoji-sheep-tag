import React, { HTMLAttributes, useEffect, useRef } from "react";

export type CollapseProps = {
  /** controls open/closed */
  isOpen: boolean;
  /** animation duration in ms */
  duration?: number;
  /** CSS easing string */
  easing?: string;
  children: React.ReactNode;
} & HTMLAttributes<HTMLDivElement>;

const Collapse: React.FC<CollapseProps> = ({
  isOpen,
  duration = 300,
  easing = "ease",
  children,
  style: styleProp,
  ...divProps
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const hasMounted = useRef(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    // First mount: snap to end state with no animation
    if (!hasMounted.current) {
      el.style.overflow = "hidden";
      el.style.height = isOpen ? "auto" : "0px";
      hasMounted.current = true;
      return;
    }

    // On updates: run animation
    el.getAnimations?.().forEach((a) => a.cancel());
    el.style.overflow = "hidden";

    const fullHeight = `${el.scrollHeight}px`;
    const keyframes = isOpen
      ? [{ height: "0px" }, { height: fullHeight }]
      : [{ height: fullHeight }, { height: "0px" }];

    const animation = el.animate?.(keyframes, { duration, easing });
    if (animation) {
      animation.onfinish = () => {
        el.style.height = isOpen ? "auto" : "0px";
        el.style.overflow = isOpen ? "" : "hidden";
      };

      return () => animation.cancel();
    }
  }, [isOpen, duration, easing]);

  // Ensure initial render matches the collapsed/open state
  const initialStyle: React.CSSProperties = {
    height: isOpen ? "auto" : "0px",
    overflow: "hidden",
  };

  return (
    <div
      {...divProps}
      ref={containerRef}
      style={{ ...initialStyle, ...styleProp }}
    >
      {children}
    </div>
  );
};

export default Collapse;
