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
  border-radius: 2px;
  transition: width ${({ theme }) => theme.motion.med} ${({ theme }) =>
  theme.motion.easeOut};
`;

const DisplayedValue = styled.div<{ $height: number | undefined }>`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: ${({ $height }) =>
    $height ? `${Math.min(14, $height - 4)}px` : "inherit"};
  text-shadow: ${({ theme }) => theme.shadow.sm};
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
