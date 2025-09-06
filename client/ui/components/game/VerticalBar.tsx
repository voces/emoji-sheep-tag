import { styled } from "npm:styled-components";

const BarContainer = styled.div<{ width?: number; height?: number }>`
  position: relative;
  width: ${({ width }) => width ?? 6}px;
  height: ${({ height }) => height ? `60px` : "initial"};
  background-color: rgba(0, 0, 0, 0.3);
  border-radius: 2px;
  box-shadow: rgba(0, 0, 0, 0.3) ${({ theme }) => theme.shadows.xs};
  overflow: hidden;
`;

const BarFill = styled.div.attrs<{ $fillPercent: number; color: string }>(
  (props) => ({
    style: { height: `${Math.max(0, Math.min(100, props.$fillPercent))}%` },
  }),
)`
  position: absolute;
  bottom: 0;
  width: 100%;
  background-color: ${({ color }) => color};
  transition: height 0.2s ease-in-out;
`;

export const VerticalBar = ({
  value,
  max,
  color,
  width,
  height,
}: {
  value: number;
  max: number;
  color: string;
  width?: number;
  height?: number;
}) => {
  const fillPercent = max > 0 ? (value / max) * 100 : 0;

  return (
    <BarContainer width={width} height={height}>
      <BarFill $fillPercent={fillPercent} color={color} />
    </BarContainer>
  );
};
