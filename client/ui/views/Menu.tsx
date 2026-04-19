import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { keyframes, styled } from "styled-components";
import { loadLocal } from "../../local.ts";
import { connect } from "../../connection.ts";
import { showSettingsVar } from "@/vars/showSettings.ts";
import { openEditor } from "../util/openEditor.ts";
import { playerNameVar } from "@/vars/playerName.ts";
import { draftModeVar } from "@/vars/draftMode.ts";
import { useReactiveVar } from "@/hooks/useVar.tsx";
import { setStoredPlayerName } from "../../util/playerPrefs.ts";
import { SvgIcon } from "@/components/SVGIcon.tsx";
import { Tag } from "@/components/Tag.tsx";
import { usePlayerCount } from "@/hooks/usePlayerCount.ts";
import { colors } from "@/shared/data.ts";
import { PencilRuler, Play, Settings, WifiOff } from "lucide-react";

// deno-lint-ignore no-process-global
const buildDate = (process.env.BUILD_TIME ?? "").slice(0, 10);

const popIn = keyframes`
  from { opacity: 0; transform: translate(-50%, -50%) translateY(8px) scale(0.98); }
  to { opacity: 1; transform: translate(-50%, -50%) translateY(0) scale(1); }
`;

const MenuCard = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 460px;
  max-width: calc(100% - 32px);
  background: ${({ theme }) => theme.surface[1]};
  border: 1px solid ${({ theme }) => theme.border.DEFAULT};
  border-radius: ${({ theme }) => theme.radius.xl};
  box-shadow: ${({ theme }) => theme.shadow.lg}, ${({ theme }) =>
    theme.shadow.inset};
  padding: ${({ theme }) => theme.space[5]};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.space[4]};
  backdrop-filter: blur(12px);
  animation: ${popIn} ${({ theme }) => theme.motion.med} ${({ theme }) =>
    theme.motion.easeOut};
`;

const Header = styled.header`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${({ theme }) => theme.space[2]} 0 ${({ theme }) => theme.space[3]};
  border-bottom: 1px solid ${({ theme }) => theme.border.soft};
`;

const Brand = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.space[3]};
`;

const Logo = styled.div`
  width: 44px;
  height: 44px;
  border-radius: ${({ theme }) => theme.radius.md};
  background: linear-gradient(160deg, ${({ theme }) => theme.surface[2]}, ${(
    { theme },
  ) => theme.surface[3]});
  border: 1px solid ${({ theme }) => theme.border.hi};
  display: grid;
  place-items: center;
  box-shadow: ${({ theme }) => theme.shadow.sm}, ${({ theme }) =>
    theme.shadow.inset};
  color: ${({ theme }) => theme.accent.DEFAULT};
`;

const Title = styled.h1`
  margin: 0;
  font-size: ${({ theme }) => theme.text.xl};
  font-weight: 600;
  letter-spacing: -0.01em;
  color: ${({ theme }) => theme.ink.hi};
`;

const Subtitle = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.space[2]};
  font-size: ${({ theme }) => theme.text.xs};
  color: ${({ theme }) => theme.ink.lo};
  margin-top: 4px;
`;

const Dot = styled.span`
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: ${({ theme }) => theme.ink.lo};
  display: inline-block;
`;

const Nav = styled.nav`
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

const Chevron = styled.span.attrs({ className: "menu-chev" })`
  color: ${({ theme }) => theme.ink.lo};
  font-size: ${({ theme }) => theme.text["2xl"]};
  line-height: 1;
  padding-right: 4px;
  transition: transform ${({ theme }) => theme.motion.fast} ${({ theme }) =>
  theme.motion.easeOut};
`;

const MenuItem = styled.button<{ $primary?: boolean }>`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.space[3]};
  padding: 12px 14px;
  border: 1px solid ${({ $primary, theme }) =>
    $primary
      ? `color-mix(in oklab, ${theme.accent.DEFAULT} 40%, ${theme.border.DEFAULT})`
      : "transparent"};
  background: ${({ $primary, theme }) =>
    $primary
      ? `color-mix(in oklab, ${theme.accent.DEFAULT} 12%, ${theme.surface[2]})`
      : "transparent"};
  border-radius: ${({ theme }) => theme.radius.md};
  color: ${({ theme }) => theme.ink.hi};
  text-align: left;
  transition:
    background ${({ theme }) => theme.motion.fast} ${({ theme }) =>
      theme.motion.easeOut},
    border-color ${({ theme }) => theme.motion.fast} ${({ theme }) =>
      theme.motion.easeOut},
    transform ${({ theme }) => theme.motion.fast} ${({ theme }) =>
      theme.motion.easeOut};
  width: 100%;
  cursor: pointer;

  &.hover {
    background: ${({ $primary, theme }) =>
      $primary
        ? `color-mix(in oklab, ${theme.accent.DEFAULT} 18%, ${
          theme.surface[2]
        })`
        : theme.surface[2]};
    border-color: ${({ $primary, theme }) =>
      $primary ? theme.accent.DEFAULT : theme.border.DEFAULT};
  }

  &.active {
    transform: translateY(1px);
  }

  &.hover .menu-chev {
    transform: translateX(2px);
    color: ${({ theme }) => theme.ink.mid};
  }
`;

const MenuItemIcon = styled.span<{ $primary?: boolean }>`
  width: 36px;
  height: 36px;
  display: grid;
  place-items: center;
  font-size: ${({ theme }) => theme.text.xl};
  color: ${({ $primary, theme }) => $primary ? theme.accent.hi : theme.ink.mid};
  background: ${({ $primary, theme }) =>
    $primary
      ? `color-mix(in oklab, ${theme.accent.DEFAULT} 20%, ${theme.surface[2]})`
      : theme.surface[2]};
  border: 1px solid ${({ $primary, theme }) =>
    $primary
      ? `color-mix(in oklab, ${theme.accent.DEFAULT} 40%, ${theme.border.DEFAULT})`
      : theme.border.DEFAULT};
  border-radius: ${({ theme }) => theme.radius.sm};
  flex-shrink: 0;
`;

const MenuItemBody = styled.span`
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
`;

const MenuItemLabel = styled.span`
  font-size: ${({ theme }) => theme.text.md};
  font-weight: 600;
  color: ${({ theme }) => theme.ink.hi};
  letter-spacing: -0.005em;
`;

const MenuItemSub = styled.span`
  font-size: ${({ theme }) => theme.text.xs};
  color: ${({ theme }) => theme.ink.lo};
`;

const Footer = styled.footer`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: ${({ theme }) => theme.space[3]};
  border-top: 1px solid ${({ theme }) => theme.border.soft};
  gap: ${({ theme }) => theme.space[3]};
`;

const Player = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.space[2]};
`;

const AvatarCircle = styled.span`
  width: 36px;
  height: 36px;
  background: ${({ theme }) => theme.surface[2]};
  border: 1px solid ${({ theme }) => theme.border.DEFAULT};
  border-radius: 50%;
  display: grid;
  place-items: center;
  overflow: hidden;
  flex-shrink: 0;
  color: ${({ theme }) => theme.wool.DEFAULT};
`;

const PlayerName = styled.div`
  font-size: ${({ theme }) => theme.text.sm};
  font-weight: 600;
  color: ${({ theme }) => theme.ink.hi};
  line-height: 1.3;
`;

const RenameButton = styled.button`
  background: transparent;
  border: none;
  padding: 0;
  color: ${({ theme }) => theme.ink.lo};
  font-size: ${({ theme }) => theme.text.xs};
  text-decoration: underline;
  text-decoration-color: ${({ theme }) => theme.border.hi};
  text-underline-offset: 3px;
  transition: color ${({ theme }) => theme.motion.fast} ${({ theme }) =>
    theme.motion.easeOut};
  cursor: pointer;

  &.hover {
    color: ${({ theme }) => theme.accent.hi};
  }
`;

const NamePrompt = styled.button`
  background: transparent;
  border: none;
  padding: 0;
  font: inherit;
  font-size: ${({ theme }) => theme.text.sm};
  font-weight: 600;
  color: ${({ theme }) => theme.accent.hi};
  line-height: 1.3;
  text-align: left;
  cursor: pointer;
  transition: color ${({ theme }) => theme.motion.fast} ${({ theme }) =>
    theme.motion.easeOut};

  &.hover {
    color: ${({ theme }) => theme.accent.DEFAULT};
  }
`;

const NameCaption = styled.div`
  font-size: ${({ theme }) => theme.text.xs};
  color: ${({ theme }) => theme.ink.lo};
  margin-top: 3px;
  line-height: 1;
`;

const NameInput = styled.input`
  display: block;
  font: inherit;
  font-size: ${({ theme }) => theme.text.sm};
  font-weight: 600;
  color: ${({ theme }) => theme.ink.hi};
  background: ${({ theme }) => theme.surface[2]};
  border: 1px solid ${({ theme }) => theme.border.hi};
  border-radius: ${({ theme }) => theme.radius.xs};
  padding: 1px 5px;
  margin: -2px -6px;
  width: calc(100% + 12px);
  max-width: 172px;
  outline: none;
  transition:
    border-color ${({ theme }) => theme.motion.fast} ${({ theme }) =>
      theme.motion.easeOut},
    background ${({ theme }) => theme.motion.fast} ${({ theme }) =>
      theme.motion.easeOut};

  &:focus {
    border-color: ${({ theme }) => theme.accent.DEFAULT};
    background: ${({ theme }) => theme.surface[1]};
    box-shadow: none;
  }

  &::selection {
    background: ${({ theme }) => theme.accent.bg};
  }
`;

const NameHint = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: ${({ theme }) => theme.text.xs};
  color: ${({ theme }) => theme.ink.lo};
  margin-top: 3px;
  line-height: 1;
`;

const Kbd = styled.kbd`
  font-family: ${({ theme }) => theme.font.mono};
  font-size: ${({ theme }) => theme.text.xs};
  background: ${({ theme }) => theme.surface[0]};
  border: 1px solid ${({ theme }) => theme.border.DEFAULT};
  border-bottom-width: 2px;
  border-radius: ${({ theme }) => theme.radius.xs};
  padding: 1px 5px;
  color: ${({ theme }) => theme.ink.lo};
  line-height: 1;
`;

const HintSep = styled.span`
  opacity: 0.5;
  margin: 0 2px;
`;

const SettingsButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: ${({ theme }) => theme.space[2]};
  padding: 4px 10px;
  min-height: 28px;
  border-radius: ${({ theme }) => theme.radius.sm};
  border: 1px solid transparent;
  background: transparent;
  color: ${({ theme }) => theme.ink.mid};
  font-size: ${({ theme }) => theme.text.sm};
  font-weight: 500;
  cursor: pointer;
  transition:
    background ${({ theme }) => theme.motion.fast} ${({ theme }) =>
      theme.motion.easeOut},
    color ${({ theme }) => theme.motion.fast} ${({ theme }) =>
      theme.motion.easeOut};

  &.hover {
    background: ${({ theme }) => theme.surface[2]};
    color: ${({ theme }) => theme.ink.hi};
  }
`;

const items = [
  {
    key: "play" as const,
    labelKey: "menu.play",
    subKey: "menu.playDescription",
    primary: true,
    icon: Play,
  },
  {
    key: "practice" as const,
    labelKey: "menu.offline",
    subKey: "menu.offlineDescription",
    primary: false,
    icon: WifiOff,
  },
  {
    key: "editor" as const,
    labelKey: "menu.editor",
    subKey: "menu.editorDescription",
    primary: false,
    icon: PencilRuler,
  },
];

const handleNavigate = (key: "play" | "practice" | "editor") => {
  switch (key) {
    case "play":
      connect();
      break;
    case "practice":
      loadLocal();
      draftModeVar("manual");
      connect();
      break;
    case "editor":
      openEditor();
      break;
  }
};

export const Menu = () => {
  const { t } = useTranslation();
  const playerCount = usePlayerCount();
  const playerName = useReactiveVar(playerNameVar);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(playerName);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const startEdit = () => {
    setDraft(playerName);
    setEditing(true);
  };

  const commit = () => {
    const trimmed = draft.trim().slice(0, 20);
    if (trimmed && trimmed !== playerName) {
      playerNameVar(trimmed);
      setStoredPlayerName(trimmed);
    }
    setEditing(false);
  };

  const cancel = () => {
    setDraft(playerName);
    setEditing(false);
  };

  return (
    <MenuCard>
      <Header>
        <Brand>
          <Logo aria-hidden>
            <div style={{ width: 28, height: 28 }}>
              <SvgIcon icon="bite" accentColor={colors[0]} />
            </div>
          </Logo>
          <div>
            <Title>{t("menu.title")}</Title>
            <Subtitle>
              <Tag>{buildDate}</Tag>
              <Dot />
              <span>{t("menu.playersOnline", { count: playerCount })}</span>
            </Subtitle>
          </div>
        </Brand>
      </Header>

      <Nav aria-label={t("menu.title")}>
        {items.map((item) => (
          <MenuItem
            key={item.key}
            $primary={item.primary}
            onClick={() => handleNavigate(item.key)}
          >
            <MenuItemIcon $primary={item.primary} aria-hidden>
              <item.icon size={20} strokeWidth={1.75} />
            </MenuItemIcon>
            <MenuItemBody>
              <MenuItemLabel>{t(item.labelKey)}</MenuItemLabel>
              <MenuItemSub>{t(item.subKey)}</MenuItemSub>
            </MenuItemBody>
            <Chevron aria-hidden>›</Chevron>
          </MenuItem>
        ))}
      </Nav>

      <Footer>
        <Player>
          <AvatarCircle aria-hidden>
            <div style={{ width: 24, height: 24 }}>
              <SvgIcon icon="sheep" accentColor={colors[0]} />
            </div>
          </AvatarCircle>
          <div>
            {editing
              ? (
                <>
                  <NameInput
                    ref={inputRef}
                    value={draft}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setDraft(e.target.value)}
                    onBlur={commit}
                    onKeyDown={(e: React.KeyboardEvent) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        commit();
                      } else if (e.code === "Backquote") {
                        e.preventDefault();
                        cancel();
                      }
                    }}
                    maxLength={20}
                    spellCheck={false}
                    aria-label={t("menu.playerName")}
                  />
                  <NameHint>
                    <Kbd>↵</Kbd> {t("menu.save")}
                    <HintSep>·</HintSep>
                    <Kbd>`</Kbd> {t("menu.cancel")}
                  </NameHint>
                </>
              )
              : playerName?.trim()
              ? (
                <>
                  <PlayerName>{playerName}</PlayerName>
                  <RenameButton type="button" onClick={startEdit}>
                    {t("menu.changeName")}
                  </RenameButton>
                </>
              )
              : (
                <>
                  <NamePrompt type="button" onClick={startEdit}>
                    {t("menu.setName")}
                  </NamePrompt>
                  <NameCaption>{t("menu.nameCaption")}</NameCaption>
                </>
              )}
          </div>
        </Player>
        <SettingsButton
          type="button"
          onClick={() => showSettingsVar(true)}
        >
          <Settings size={13} strokeWidth={1.75} /> {t("menu.settings")}
        </SettingsButton>
      </Footer>
    </MenuCard>
  );
};
