import { styled } from "styled-components";
import { type ButtonHTMLAttributes, forwardRef } from "react";
import { useTooltip } from "@/hooks/useTooltip.tsx";

const StyledButton = styled.button`
  border: 0;
  background: ${({ theme }) => theme.surface[2]};
  color: ${({ theme }) => theme.ink.hi};
  padding: 0 ${({ theme }) => theme.space[2]};
  cursor: pointer;
  outline: none;

  &.hover:not([disabled]) {
    background: ${({ theme }) => theme.surface[3]};
    box-shadow: ${({ theme }) => theme.shadow.sm};
  }

  &:disabled {
    background: ${({ theme }) => theme.surface[1]};
    color: ${({ theme }) => theme.ink.mute};
    cursor: not-allowed;
  }
`;

const Underline = styled.span`
  text-decoration: underline;
`;

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  accessKey?: string;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ children, accessKey, title, ...props }, ref) => {
    const { tooltipContainerProps, tooltip } = useTooltip<HTMLButtonElement>(
      title,
    );

    let content = children;

    if (accessKey && typeof children === "string") {
      const lowerAccessKey = accessKey.toLowerCase();
      const index = children.toLowerCase().indexOf(lowerAccessKey);

      if (index !== -1) {
        content = (
          <span aria-hidden>
            {children.slice(0, index)}
            <Underline>{children[index]}</Underline>
            {children.slice(index + 1)}
          </span>
        );
      }
    }

    return (
      <>
        <StyledButton
          ref={(el) => {
            tooltipContainerProps.ref.current = el;
            if (typeof ref === "function") ref(el);
            else if (ref) ref.current = el;
          }}
          accessKey={accessKey}
          aria-label={accessKey && typeof children === "string" &&
              typeof content != "string"
            ? children
            : undefined}
          onMouseEnter={tooltipContainerProps.onMouseEnter}
          onMouseLeave={tooltipContainerProps.onMouseLeave}
          {...props}
        >
          {content}
        </StyledButton>
        {tooltip}
      </>
    );
  },
);

Button.displayName = "Button";
