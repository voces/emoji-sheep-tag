import { styled } from "styled-components";
import { type BarProps, BaseBarContainer } from "./Bar.tsx";

const VerticalBarContainer = styled(BaseBarContainer)<
  { width?: number; height?: number }
>`
  width: ${({ width }) => width ?? 6}px;
  height: ${({ height }) => height ? `60px` : "initial"};
`;

const VerticalBarFill = styled.div.attrs<
  { $fillPercent: number; color: string }
>(
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
}: BarProps) => {
  const fillPercent = max > 0 ? (value / max) * 100 : 0;

  return (
    <VerticalBarContainer width={width} height={height}>
      <VerticalBarFill $fillPercent={fillPercent} color={color} />
    </VerticalBarContainer>
  );
};
