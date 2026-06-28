import { forwardRef, type HTMLAttributes, type ReactNode } from "react";
import { styled } from "styled-components";
import { useTooltip } from "../hooks/useTooltip.tsx";

const BaseTag = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px 3px;
  border-radius: ${({ theme }) => theme.radius.pill};
  font-size: ${({ theme }) => theme.text.xs};
  font-weight: 500;
  letter-spacing: 0.02em;
  border: 1px solid ${({ theme }) => theme.border.DEFAULT};
  background: ${({ theme }) => theme.surface[2]};
  color: ${({ theme }) => theme.ink.mid};
  line-height: 1;
`;

const AccentBaseTag = styled(BaseTag)`
  color: ${({ theme }) => theme.accent.hi};
  border-color: color-mix(
    in oklab,
    ${({ theme }) => theme.accent.DEFAULT} 35%,
    ${({ theme }) => theme.border.DEFAULT}
  );
  background: ${({ theme }) => theme.accent.bg};
`;

const DangerBaseTag = styled(BaseTag)`
  color: ${({ theme }) => theme.danger.DEFAULT};
  border-color: color-mix(
    in oklab,
    ${({ theme }) => theme.danger.DEFAULT} 35%,
    ${({ theme }) => theme.border.DEFAULT}
  );
  background: ${({ theme }) => theme.danger.bg};
`;

const SuccessBaseTag = styled(BaseTag)`
  color: ${({ theme }) => theme.success.DEFAULT};
  border-color: color-mix(
    in oklab,
    ${({ theme }) => theme.success.DEFAULT} 35%,
    ${({ theme }) => theme.border.DEFAULT}
  );
  background: ${({ theme }) => theme.success.bg};
`;

const GoldBaseTag = styled(BaseTag)`
  color: ${({ theme }) => theme.game.gold};
  border-color: color-mix(
    in oklab,
    ${({ theme }) => theme.game.gold} 35%,
    ${({ theme }) => theme.border.DEFAULT}
  );
  background: color-mix(
    in oklab,
    ${({ theme }) => theme.game.gold} 14%,
    transparent
  );
`;

export type TagProps = HTMLAttributes<HTMLSpanElement> & {
  /** Shown in a tooltip on hover. Use this instead of `title`, which the
   * simulated in-game pointer can't trigger. */
  tooltip?: ReactNode;
};

const tagWithTooltip = (Span: typeof BaseTag) =>
  forwardRef<HTMLSpanElement, TagProps>(
    ({ tooltip, children, ...rest }, ref) => {
      const { tooltipContainerProps, tooltip: tooltipEl } = useTooltip<
        HTMLSpanElement
      >(tooltip);

      if (!tooltip) return <Span ref={ref} {...rest}>{children}</Span>;

      const { ref: containerRef, ...handlers } = tooltipContainerProps;
      const setRef = (node: HTMLSpanElement | null) => {
        (containerRef as { current: HTMLSpanElement | null }).current = node;
        if (typeof ref === "function") ref(node);
        else if (ref) {
          (ref as { current: HTMLSpanElement | null }).current = node;
        }
      };

      return (
        <Span ref={setRef} {...handlers} {...rest}>
          {children}
          {tooltipEl}
        </Span>
      );
    },
  );

export const Tag = tagWithTooltip(BaseTag);
export const AccentTag = tagWithTooltip(AccentBaseTag);
export const DangerTag = tagWithTooltip(DangerBaseTag);
export const SuccessTag = tagWithTooltip(SuccessBaseTag);
export const GoldTag = tagWithTooltip(GoldBaseTag);
