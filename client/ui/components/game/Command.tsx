import { useMemo } from "react";
import { styled } from "npm:styled-components";
import { SvgIcon } from "@/components/SVGIcon.tsx";
import { useTooltip } from "@/hooks/useTooltip.tsx";
import { useLocalPlayer } from "@/vars/players.ts";
import { formatShortcut } from "@/util/formatShortcut.ts";
import {
  CommandButton,
  CommandCount,
  CommandShortcut,
} from "@/components/Command.tsx";

const ShortcutStyle = styled.span`
  color: ${({ theme }) => theme.colors.gold};
`;

const GoldContainer = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing.sm};
  align-items: center;
  color: ${({ theme }) => theme.colors.gold};
`;

const ManaContainer = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing.sm};
  align-items: center;
  color: ${({ theme }) => theme.colors.mana};
`;

const Hr = styled.hr`
  margin: 4px 0;
  opacity: 0.5;
`;

const Description = styled.div`
  line-height: 1.25;
`;

const IconContainer = styled.span`
  width: 24px;
  height: 24px;
  display: inline-block;
`;

export const Command = ({
  name,
  description,
  icon,
  binding,
  iconScale,
  pressed,
  disabled,
  goldCost,
  manaCost,
  hideTooltip,
  iconProps,
  count,
}: {
  name: string;
  description?: string;
  icon?: string;
  binding?: ReadonlyArray<string>;
  iconScale?: number;
  pressed?: boolean;
  disabled?: boolean;
  goldCost?: number;
  manaCost?: number;
  hideTooltip?: boolean;
  iconProps?: Partial<React.ComponentProps<typeof SvgIcon>>;
  count?: number;
}) => {
  const localPlayer = useLocalPlayer();

  const { tooltipContainerProps, tooltip } = useTooltip(useMemo(() => (
    <>
      <div>
        <span>{name}</span>
        {binding?.length
          ? (
            <>
              {" ("}
              <ShortcutStyle>{formatShortcut(binding)}</ShortcutStyle>
              {")"}
            </>
          )
          : null}
      </div>
      {(goldCost ?? 0) > 0 && (
        <GoldContainer>
          <IconContainer>
            <SvgIcon icon="gold" aria-label="Gold" />
          </IconContainer>
          <span>{goldCost}</span>
        </GoldContainer>
      )}
      {(manaCost ?? 0) > 0 && (
        <ManaContainer>
          <IconContainer>
            <SvgIcon icon="sapphire" aria-label="Mana" />
          </IconContainer>
          <span>{manaCost}</span>
        </ManaContainer>
      )}
      {description && (
        <>
          <Hr />
          <Description>{description}</Description>
        </>
      )}
    </>
  ), [name, goldCost, manaCost]));

  const handleClick = () => {
    if (!binding?.length) return;

    for (const code of binding) {
      const event = new KeyboardEvent("keydown", {
        code,
        bubbles: true,
        cancelable: true,
      });
      Object.defineProperty(event, "fromHud", { value: true });
      document.dispatchEvent(event);
    }

    for (const code of binding.toReversed()) {
      const event = new KeyboardEvent("keyup", {
        code,
        bubbles: true,
        cancelable: true,
      });
      Object.defineProperty(event, "fromHud", { value: true });
      document.dispatchEvent(event);
    }
  };

  return (
    <CommandButton
      role="button"
      aria-label={name}
      aria-disabled={disabled}
      aria-pressed={pressed}
      onClick={handleClick}
      style={{
        filter: disabled ? "saturate(0.3) brightness(0.7)" : undefined,
        opacity: disabled ? 0.6 : undefined,
      }}
      {...tooltipContainerProps}
    >
      {icon && (
        <SvgIcon
          icon={icon}
          color={localPlayer?.color}
          scale={iconScale}
          {...iconProps}
        />
      )}
      {binding?.length && (
        <CommandShortcut>{formatShortcut(binding)}</CommandShortcut>
      )}
      {typeof count === "number" && <CommandCount>{count}</CommandCount>}
      {!hideTooltip && tooltip}
    </CommandButton>
  );
};
