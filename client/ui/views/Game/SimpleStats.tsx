import { useTranslation } from "react-i18next";
import { styled } from "styled-components";
import { useReactiveVar } from "@/hooks/useVar.tsx";
import { uiSettingsVar } from "@/vars/uiSettings.ts";
import { useEffect, useState } from "react";
import { stats } from "../../../util/Stats.ts";
import { getFps } from "../../../graphics/three.ts";

const SimpleStatsContainer = styled.div`
  position: fixed;
  top: ${({ theme }) => theme.space[3]};
  left: ${({ theme }) => theme.space[4]};
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.space[2]};
  background: ${({ theme }) => theme.surface.scrim};
  backdrop-filter: blur(10px);
  border: 1px solid ${({ theme }) => theme.border.soft};
  border-radius: ${({ theme }) => theme.radius.sm};
  padding: ${({ theme }) => theme.space[1]} 10px;
  box-shadow: ${({ theme }) => theme.shadow.md};
  font-size: ${({ theme }) => theme.text.xs};
  color: ${({ theme }) => theme.ink.mid};
  pointer-events: none;
`;

const StatSep = styled.span`
  width: 1px;
  height: 10px;
  background: ${({ theme }) => theme.border.DEFAULT};
`;

const StatValue = styled.b`
  color: ${({ theme }) => theme.ink.hi};
  font-weight: 600;
`;

const FPS = () => {
  const { t } = useTranslation();
  const [fps, setFps] = useState(getFps());

  useEffect(() => {
    const interval = setInterval(() => {
      setFps(getFps());
    }, 500);
    return () => clearInterval(interval);
  }, []);

  return (
    <span className="mono">
      {t("hud.fps")} <StatValue>{Math.round(fps)}</StatValue>
    </span>
  );
};

const Ping = () => {
  const { t } = useTranslation();
  const [ping, setPing] = useState(stats.msPanel.value);

  useEffect(() => {
    const interval = setInterval(() => {
      setPing(stats.msPanel.value);
    }, 500);
    return () => clearInterval(interval);
  }, []);

  return (
    <span className="mono">
      {t("hud.ping")}{" "}
      <StatValue>{isNaN(ping) ? "-" : Math.round(ping)}</StatValue>
    </span>
  );
};

export const SimpleStats = () => {
  const { showFps, showPing } = useReactiveVar(uiSettingsVar);

  if (!showFps && !showPing) return null;

  return (
    <SimpleStatsContainer>
      {showFps && <FPS />}
      {showFps && showPing && <StatSep />}
      {showPing && <Ping />}
    </SimpleStatsContainer>
  );
};
