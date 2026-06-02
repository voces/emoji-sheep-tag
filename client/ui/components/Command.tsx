import { keyframes, styled } from "styled-components";

export const CommandButton = styled.div`
  position: relative;
  width: 44px;
  height: 44px;
  background: ${({ theme }) => theme.surface[2]};
  border: 1px solid ${({ theme }) => theme.border.DEFAULT};
  border-radius: ${({ theme }) => theme.radius.sm};
  overflow: hidden;
  transition: all ${({ theme }) => theme.motion.fast} ${({ theme }) =>
    theme.motion.easeOut};

  &[aria-pressed="true"] {
    background: ${({ theme }) => theme.surface[3]};
    border-color: ${({ theme }) => theme.accent.DEFAULT};
  }

  &[aria-disabled="true"] {
    opacity: 0.4;
  }

  &.hover[role="button"]:not([aria-disabled="true"]):not([data-autocast]) {
    background: ${({ theme }) => theme.surface[3]};
    border-color: ${({ theme }) => theme.accent.DEFAULT};
    transform: translateY(-1px);
  }

  /* The gold dashed edge (static when autocastable, marching when enabled) is
    drawn by the MarchingAnts SVG overlay; keep the 1px border for layout. */
  &[data-autocast] {
    border-color: transparent;
  }
`;

/**
 * Gold dashed border for autocastable abilities, drawn as a single SVG rect
 * stroke so both states share identical dash lengths. The 1px stroke (matching
 * the button border) stays 1px regardless of scaling via vector-effect, and a
 * single continuous path means the dashes follow the rounded corners cleanly.
 * When `animated`, an animated stroke-dashoffset marches the dashes around the
 * perimeter; the offset spans exactly one dash period so the loop is seamless.
 */
const antsMarch = keyframes`
  to { stroke-dashoffset: -10; }
`;

const MarchingAntsSvg = styled.svg`
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  color: ${({ theme }) => theme.game.gold};

  rect {
    fill: none;
    stroke: currentColor;
    stroke-width: 1;
    stroke-dasharray: 5 5;
  }

  &[data-animated="true"] rect {
    animation: ${antsMarch} 0.4s linear infinite;
  }
`;

export const MarchingAnts = ({ animated }: { animated?: boolean }) => (
  <MarchingAntsSvg
    viewBox="0 0 44 44"
    preserveAspectRatio="none"
    data-animated={animated ? "true" : undefined}
    aria-hidden
  >
    <rect
      x="0.5"
      y="0.5"
      width="43"
      height="43"
      rx="4.5"
      vectorEffect="non-scaling-stroke"
    />
  </MarchingAntsSvg>
);

const CommandBadge = styled.span`
  position: absolute;
  bottom: 2px;
  font-family: ${({ theme }) => theme.font.mono};
  font-size: 9px;
  background: ${({ theme }) => theme.surface[0]};
  border-radius: 2px;
  padding: 0 3px;
  line-height: 14px;
  height: 14px;
  letter-spacing: 0.02em;
`;

export const CommandShortcut = styled(CommandBadge).attrs({ as: "kbd" })`
  right: 2px;
  color: ${({ theme }) => theme.ink.mid};

  [aria-disabled="true"] > & {
    color: ${({ theme }) => theme.ink.mute};
  }
`;

export const CommandCount = styled(CommandBadge)`
  left: 2px;
  color: ${({ theme }) => theme.ink.hi};
`;
