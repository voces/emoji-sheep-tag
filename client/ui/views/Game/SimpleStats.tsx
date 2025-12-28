import { styled } from "styled-components";
import { HStack } from "@/components/layout/Layout.tsx";
import { useReactiveVar } from "@/hooks/useVar.tsx";
import { uiSettingsVar } from "@/vars/uiSettings.ts";
import { useEffect, useState } from "react";
import { stats } from "../../../util/Stats.ts";
import { getFps } from "../../../graphics/three.ts";

const SimpleStatsContainer = styled(HStack)`
  position: fixed;
  top: ${({ theme }) => theme.spacing.md};
  left: 35%;
  pointer-events: none;
  gap: ${({ theme }) => theme.spacing.xl};
  font-size: ${({ theme }) => theme.fontSize.md};
`;

const FPS = () => {
  const [fps, setFps] = useState(getFps());

  useEffect(() => {
    const interval = setInterval(() => {
      setFps(getFps());
    }, 500);
    return () => clearInterval(interval);
  }, []);

  return <span>{`FPS: ${Math.round(fps)}`}</span>;
};

const Ping = () => {
  const [ping, setPing] = useState(stats.msPanel.value);

  useEffect(() => {
    const interval = setInterval(() => {
      setPing(stats.msPanel.value);
    }, 500);
    return () => clearInterval(interval);
  }, []);

  return <span>{`Ping: ${Math.round(ping)}`}</span>;
};

export const SimpleStats = () => {
  const { showFps, showPing } = useReactiveVar(uiSettingsVar);

  if (!showFps && !showPing) return null;

  return (
    <SimpleStatsContainer>
      {showFps && <FPS />}
      {showPing && <Ping />}
    </SimpleStatsContainer>
  );
};
