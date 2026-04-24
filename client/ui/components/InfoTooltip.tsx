import { Info } from "lucide-react";
import { styled } from "styled-components";
import { useTooltip } from "../hooks/useTooltip.tsx";

const IconWrapper = styled.span`
  display: inline-flex;
  align-items: center;
  color: ${({ theme }) => theme.ink.lo};
  cursor: help;
`;

export const InfoTooltip = ({ text }: { text: string }) => {
  const { tooltipContainerProps, tooltip } = useTooltip(text);

  return (
    <IconWrapper {...tooltipContainerProps}>
      <Info size={14} />
      {tooltip}
    </IconWrapper>
  );
};
