import { Info, type LucideIcon } from "lucide-react";
import { styled } from "styled-components";
import { useTooltip } from "../hooks/useTooltip.tsx";
import { type ReactNode } from "react";

const IconWrapper = styled.span`
  display: inline-flex;
  align-items: center;
  color: ${({ theme }) => theme.ink.lo};
  cursor: help;
`;

export const IconTooltip = (
  { icon: Icon = Info, size = 14, content, color }: {
    icon?: LucideIcon;
    size?: number;
    content: ReactNode;
    color?: string;
  },
) => {
  const { tooltipContainerProps, tooltip } = useTooltip(content);

  return (
    <IconWrapper
      {...tooltipContainerProps}
      style={color ? { color } : undefined}
    >
      <Icon size={size} />
      {tooltip}
    </IconWrapper>
  );
};

export const InfoTooltip = ({ text }: { text: string }) => (
  <IconTooltip content={text} />
);
