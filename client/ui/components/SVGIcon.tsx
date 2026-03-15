import { useEffect, useRef } from "react";
import { styled } from "styled-components";
import { Color } from "three";
import { svgs } from "../../systems/models.ts";
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

const svgNodeCache = new Map<string, Node>();

const buildSvgNode = (icon: string, accentColor?: string): Node | null => {
  const cacheKey = `${icon}:${accentColor ?? ""}`;
  const cached = svgNodeCache.get(cacheKey);
  if (cached) return cached.cloneNode(true);

  const html = svgs[icon];
  if (!html) return null;

  const tmp = document.createElement("div");
  tmp.innerHTML = html;

  const svg = tmp.querySelector("svg");
  if (svg) svg.setAttribute("preserveAspectRatio", "xMidYMid meet");

  if (accentColor) {
    const playerColor = new Color(accentColor);
    tmp.style.cssText =
      "position:absolute;visibility:hidden;pointer-events:none";
    document.body.appendChild(tmp);

    tmp.querySelectorAll("[data-player]").forEach((n) => {
      if (!(n instanceof SVGElement)) return;
      const current = getComputedStyle(n).fill;
      if (!current) return;

      let alpha: number | undefined;
      let rgbOnly = current;
      if (current.startsWith("rgba(")) {
        const match = current.match(/rgba?\(([^)]+)\)/);
        if (match) {
          const values = match[1].split(",").map((v) => v.trim());
          rgbOnly = `rgb(${values[0]}, ${values[1]}, ${values[2]})`;
          alpha = parseFloat(values[3]);
        }
      }

      const baseColor = new Color(rgbOnly).convertLinearToSRGB();
      const lum = (baseColor.r + baseColor.g + baseColor.b) / 3;
      let newColor: Color;
      if (lum < 0.5) {
        newColor = playerColor.clone().multiplyScalar(lum * 2);
      } else {
        newColor = playerColor.clone().lerp(
          new Color(1, 1, 1),
          (lum - 0.5) * 2,
        );
      }

      const hexColor = "#" + newColor.getHexString();
      if (alpha !== undefined) {
        n.style.fill = `rgba(${parseInt(hexColor.slice(1, 3), 16)}, ${
          parseInt(hexColor.slice(3, 5), 16)
        }, ${parseInt(hexColor.slice(5, 7), 16)}, ${alpha})`;
      } else {
        n.style.fill = hexColor;
      }
    });

    document.body.removeChild(tmp);
  }

  // Cache the first child (the SVG wrapper content), not the tmp div
  const fragment = document.createDocumentFragment();
  while (tmp.firstChild) fragment.appendChild(tmp.firstChild);
  svgNodeCache.set(cacheKey, fragment);
  return fragment.cloneNode(true);
};

export const SvgIcon = ({
  icon,
  accentColor,
  scale,
  overlayStyle,
  ...rest
}: {
  icon: string;
  accentColor?: string;
  scale?: number | null;
  overlayStyle?: React.CSSProperties;
} & React.HTMLAttributes<HTMLDivElement>) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const node = buildSvgNode(icon, accentColor);
    if (!node) return;
    ref.current.replaceChildren(node);
  }, [icon, accentColor]);

  if (!(icon in svgs)) return null;

  return (
    <SvgContainer>
      <div
        ref={ref}
        {...rest}
        style={{
          color: accentColor,
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
