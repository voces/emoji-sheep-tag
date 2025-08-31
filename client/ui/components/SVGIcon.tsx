//@deno-types="npm:@types/react"
import { useEffect, useRef } from "react";
import { Color } from "three";
import { svgs } from "../../systems/three.ts";

export const SvgIcon = ({
  icon,
  color,
  scale,
  ...rest
}: {
  icon: string;
  color?: string;
  scale?: number;
} & React.HTMLAttributes<HTMLDivElement>) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    ref.current.innerHTML = svgs[icon];
    if (!color) return;
    ref.current.querySelectorAll("[data-player]").forEach((n) => {
      if (!(n instanceof SVGElement)) return;
      const current = getComputedStyle(n).fill;
      if (!current) return;
      const newColor = "#" +
        new Color(current).multiply(new Color(color)).getHexString();
      n.style.fill = newColor;
    });
  }, [icon, color]);

  if (!(icon in svgs)) return null;

  return (
    <div
      ref={ref}
      {...rest}
      style={{
        color,
        transform: scale ? `scale(${scale})` : undefined,
        filter: icon === "wolf"
          ? "brightness(1.5) brightness(0.6) sepia(1) hue-rotate(160deg) saturate(5)"
          : undefined,
        ...rest.style,
      }}
    />
  );
};
