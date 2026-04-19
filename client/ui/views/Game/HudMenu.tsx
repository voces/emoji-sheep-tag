import { useTranslation } from "react-i18next";
import { styled } from "styled-components";
import { useReactiveVar } from "@/hooks/useVar.tsx";
import { useTooltip } from "@/hooks/useTooltip.tsx";
import { showCommandPaletteVar } from "@/vars/showCommandPalette.ts";
import { shortcutsVar } from "@/vars/shortcuts.ts";
import { formatShortcut } from "@/util/formatShortcut.ts";

const MenuButton = styled.button`
  height: 30px;
  min-width: 30px;
  padding: 0 ${({ theme }) => theme.space[2]};
  background: ${({ theme }) => theme.surface.scrim};
  backdrop-filter: blur(10px);
  border: 1px solid ${({ theme }) => theme.border.DEFAULT};
  border-radius: ${({ theme }) => theme.radius.sm};
  box-shadow: ${({ theme }) => theme.shadow.md};
  display: grid;
  place-items: center;
  color: ${({ theme }) => theme.ink.mid};
  font-family: ${({ theme }) => theme.font.mono};
  font-size: ${({ theme }) => theme.text.md};
  font-weight: 600;
  transition: all ${({ theme }) => theme.motion.fast};
  pointer-events: auto;

  &.hover {
    background: ${({ theme }) => theme.surface[3]};
    color: ${({ theme }) => theme.ink.hi};
  }
`;

export const HudMenu = () => {
  const { t } = useTranslation();
  const shortcuts = useReactiveVar(shortcutsVar);
  const binding = shortcuts.misc.openCommandPalette;
  const label = binding ? formatShortcut(binding) : "/";
  const { tooltipContainerProps, tooltip } = useTooltip<HTMLButtonElement>(
    t("hud.quickActions"),
  );

  return (
    <MenuButton
      onClick={() => setTimeout(() => showCommandPaletteVar("open"), 0)}
      aria-label={t("hud.quickActions")}
      {...tooltipContainerProps}
    >
      {label}
      {tooltip}
    </MenuButton>
  );
};
