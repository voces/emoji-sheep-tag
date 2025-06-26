//@deno-types="npm:@types/react"
import { useEffect, useRef } from "react";
import { svgs } from "../../systems/three.ts";

export const SvgIcon = ({
  icon,
  color,
  scale,
}: {
  icon: string;
  color?: string;
  scale?: number;
}) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current) ref.current.innerHTML = svgs[icon];
  }, [icon]);

  return (
    <div
      ref={ref}
      style={{
        color,
        transform: scale ? `scale(${scale})` : undefined,
        filter: icon === "wolf"
          ? "brightness(1.5) brightness(0.6) sepia(1) hue-rotate(160deg) saturate(5)"
          : undefined,
      }}
    />
  );
};
