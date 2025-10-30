import { useEffect, useRef } from "react";
import { styled } from "styled-components";
import { Color } from "three";
import { svgs } from "../../systems/three.ts";
import { computeBlueprintColor } from "../../util/colorHelpers.ts";
import { getPlayer } from "@/vars/players.ts";

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
      const newColor = "#" +
        new Color(current).multiply(new Color(color)).getHexString();
      n.style.fill = newColor;
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
          player ? getPlayer(player)?.color ?? 0xffffff : 0xffffff,
          0x0000ff,
        ).toString(16).padStart(6, "0")
      }`,
    },
  }),
};
