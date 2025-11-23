import { styled } from "styled-components";
import { type BarProps, BaseBarContainer } from "./Bar.tsx";

const HorizontalBarContainer = styled(BaseBarContainer)<
  { width?: number; height?: number }
>`
  position: relative;
  width: ${({ width }) => width ? `${width}px` : "initial"};
  height: ${({ height }) => height ?? 6}px;
`;

const HorizontalBarFill = styled.div.attrs<
  { $fillPercent: number; color: string }
>(
  (props) => ({
    style: { width: `${Math.max(0, Math.min(100, props.$fillPercent))}%` },
  }),
)`
  position: absolute;
  left: 0;
  height: 100%;
  background-color: ${({ color }) => color};
  transition: width 0.2s ease-in-out;
`;

const DisplayedValue = styled.div<{ $height: number | undefined }>`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  text-align: center;
  font-size: min(1em, ${({ $height }) => $height ? `${$height - 5}px` : "1em"});
`;

export const HorizontalBar = ({
  value,
  max,
  color,
  width,
  height,
  displayValues,
}: BarProps & { displayValues?: boolean }) => {
  const fillPercent = max > 0 ? (value / max) * 100 : 0;

  return (
    <HorizontalBarContainer width={width} height={height}>
      <HorizontalBarFill $fillPercent={fillPercent} color={color} />
      {displayValues && (
        <DisplayedValue $height={height}>
          {Math.round(value)} / {Math.round(max)}
        </DisplayedValue>
      )}
    </HorizontalBarContainer>
  );
};
