import { useEffect, useRef } from "react";
import { styled } from "styled-components";
import { Color } from "three";
import { svgs } from "../../systems/three.ts";
import { computeBlueprintColor } from "../../util/colorHelpers.ts";
import { getPlayer } from "@/shared/api/player.ts";

const SvgContainer = styled.div`
  position: relative;
  width: 100%;
  height: 100%;

  & > div {
    width: 100%;
    height: 100%;
  }

  svg {
    width: 100%;
    height: 100%;
    display: block;
  }
`;

const Overlay = styled.div`
  position: absolute;
  inset: 0;
  mix-blend-mode: multiply;
`;

export const SvgIcon = ({
  icon,
  color,
  scale,
  overlayStyle,
  ...rest
}: {
  icon: string;
  color?: string;
  scale?: number | null;
  overlayStyle?: React.CSSProperties;
} & React.HTMLAttributes<HTMLDivElement>) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    ref.current.innerHTML = svgs[icon];

    // Ensure SVG maintains aspect ratio
    const svg = ref.current.querySelector("svg");
    if (svg) {
      svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
    }

    if (!color) return;
    ref.current.querySelectorAll("[data-player]").forEach((n) => {
      if (!(n instanceof SVGElement)) return;
      const current = getComputedStyle(n).fill;
      if (!current) return;

      let alpha: number | undefined;

      // Extract alpha channel if present
      let rgbOnly = current;
      if (current.startsWith("rgba(")) {
        const match = current.match(/rgba?\(([^)]+)\)/);
        if (match) {
          const values = match[1].split(",").map((v) => v.trim());
          rgbOnly = `rgb(${values[0]}, ${values[1]}, ${values[2]})`;
          alpha = parseFloat(values[3]);
        }
      } else if (current.match(/^#[0-9a-fA-F]{8}$/)) {
        // 8-digit hex with alpha
        alpha = parseInt(current.slice(7, 9), 16) / 255;
        rgbOnly = "#" + current.slice(1, 7);
      }

      const newColor = "#" +
        new Color(rgbOnly).multiply(new Color(color)).getHexString();

      // Apply color with alpha if present
      if (alpha !== undefined) {
        n.style.fill = `rgba(${parseInt(newColor.slice(1, 3), 16)}, ${
          parseInt(newColor.slice(3, 5), 16)
        }, ${parseInt(newColor.slice(5, 7), 16)}, ${alpha})`;
      } else {
        n.style.fill = newColor;
      }
    });
  }, [icon, color]);

  if (!(icon in svgs)) return null;

  return (
    <SvgContainer>
      <div
        ref={ref}
        {...rest}
        style={{
          color,
          transform: scale ? `scale(${scale})` : undefined,
          ...rest.style,
        }}
      />
      {overlayStyle && <Overlay style={overlayStyle} />}
    </SvgContainer>
  );
};

export const iconEffects = {
  mirror: (player: string | undefined) => ({
    overlayStyle: {
      backgroundColor: `#${
        computeBlueprintColor(
          getPlayer(player)?.playerColor ?? 0xffffff,
          0x0000ff,
        ).toString(16).padStart(6, "0")
      }`,
    },
  }),
};
