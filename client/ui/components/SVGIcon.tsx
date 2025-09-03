//@deno-types="npm:@types/react"
import { useEffect, useRef } from "react";
import { Color } from "three";
import { svgs } from "../../systems/three.ts";
import { computeBlueprintColor } from "../../util/colorHelpers.ts";
import { getPlayer } from "@/vars/players.ts";

export const SvgIcon = ({
  icon,
  color,
  scale,
  overlayStyle,
  ...rest
}: {
  icon: string;
  color?: string;
  scale?: number;
  overlayStyle?: React.CSSProperties;
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
    <div>
      <div
        ref={ref}
        {...rest}
        style={{
          color,
          transform: scale ? `scale(${scale})` : undefined,
          ...rest.style,
        }}
      />
      {overlayStyle && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            mixBlendMode: "multiply",
            ...overlayStyle,
          }}
        />
      )}
    </div>
  );
};

export const iconEffects = {
  mirror: (player: string | undefined) => ({
    overlayStyle: {
      backgroundColor: `#${
        computeBlueprintColor(
          player ? getPlayer(player)?.color ?? 0xffffff : 0xffffff,
          0x0000ff,
        ).toString(16).padStart(6, "0")
      }`,
    },
  }),
};
