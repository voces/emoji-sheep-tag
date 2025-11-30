import { useMemo } from "react";
import { keyframes, styled } from "styled-components";
import { SvgIcon } from "@/components/SVGIcon.tsx";
import { useTooltip } from "@/hooks/useTooltip.tsx";
import { useLocalPlayer } from "@/hooks/usePlayers.ts";
import { formatShortcut } from "@/util/formatShortcut.ts";
import {
  CommandButton,
  CommandCount,
  CommandShortcut,
} from "@/components/Command.tsx";

const flash = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: 0.25; }
`;

const FlashingCommandButton = styled(CommandButton)`
  &[data-flashing="true"] {
    animation: ${flash} var(--flash-duration) linear infinite;
  }
`;

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

const CooldownOverlay = styled.div<{ $progress: number }>`
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: conic-gradient(
    from 0deg,
    transparent ${({ $progress }) => $progress * 360}deg,
    rgba(0, 0, 0, 0.7) ${({ $progress }) => $progress * 360}deg
  );
  border-radius: inherit;
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
  onClick,
  flashDuration,
  accentColor,
  cooldownRemaining,
  cooldownTotal,
  ...rest
}: {
  name: string;
  description?: string;
  icon?: string;
  binding?: ReadonlyArray<string>;
  iconScale?: number | null;
  pressed?: boolean;
  disabled?: boolean;
  goldCost?: number;
  manaCost?: number;
  hideTooltip?: boolean;
  iconProps?: Partial<React.ComponentProps<typeof SvgIcon>>;
  count?: number;
  onClick?: () => void;
  flashDuration?: number;
  accentColor?: string;
  cooldownRemaining?: number;
  cooldownTotal?: number;
} & React.ComponentProps<typeof CommandButton>) => {
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
  ), [name, goldCost, manaCost, description]));

  const handleClick = () => {
    onClick?.();

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
    <FlashingCommandButton
      role={binding?.length ? "button" : undefined}
      aria-label={name}
      aria-disabled={disabled}
      aria-pressed={pressed}
      onClick={handleClick}
      data-flashing={flashDuration && flashDuration > 0 ? "true" : undefined}
      style={flashDuration && flashDuration > 0
        ? { "--flash-duration": `${flashDuration}s` } as React.CSSProperties
        : undefined}
      {...(name ? tooltipContainerProps : undefined)}
      {...rest}
    >
      {icon && (
        <SvgIcon
          icon={icon}
          accentColor={accentColor ?? localPlayer?.playerColor ?? undefined}
          scale={(iconScale ?? 1) * 0.9}
          {...iconProps}
        />
      )}
      {binding?.length
        ? <CommandShortcut>{formatShortcut(binding)}</CommandShortcut>
        : null}
      {typeof count === "number" && <CommandCount>{count}</CommandCount>}
      {typeof cooldownRemaining === "number" &&
        typeof cooldownTotal === "number" &&
        cooldownRemaining > 0 && cooldownTotal > 0 && (
        <CooldownOverlay $progress={1 - cooldownRemaining / cooldownTotal} />
      )}
      {!hideTooltip && tooltip}
    </FlashingCommandButton>
  );
};
