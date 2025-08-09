import { useMemo } from "react";
import { styled } from "npm:styled-components";
import { SvgIcon } from "@/components/SVGIcon.tsx";
import { useTooltip } from "@/hooks/useTooltip.tsx";
import { useLocalPlayer } from "@/vars/players.ts";
import { formatShortcut } from "@/util/formatShortcut.ts";
import { CommandButton, CommandShortcut } from "@/components/Command.tsx";

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

const IconContainer = styled.span`
  width: 24px;
  height: 24px;
  display: inline-block;
`;

export const Command = ({
  name,
  icon,
  binding,
  iconScale,
  current,
  disabled,
  goldCost,
  manaCost,
}: {
  name: string;
  icon?: string;
  binding?: ReadonlyArray<string>;
  iconScale?: number;
  current?: boolean;
  disabled?: boolean;
  goldCost?: number;
  manaCost?: number;
}) => {
  const localPlayer = useLocalPlayer();

  const { tooltipContainerProps, tooltip } = useTooltip(useMemo(() => (
    <div>
      <div>{name}</div>
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
    </div>
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
      aria-pressed={current}
      onClick={handleClick}
      style={{
        filter: disabled ? "saturate(0.3) brightness(0.7)" : undefined,
        opacity: disabled ? 0.6 : undefined,
      }}
      {...tooltipContainerProps}
    >
      {icon && (
        <SvgIcon icon={icon} color={localPlayer?.color} scale={iconScale} />
      )}
      {binding?.length && <CommandShortcut>{formatShortcut(binding)}</CommandShortcut>}
      {tooltip}
    </CommandButton>
  );
};
