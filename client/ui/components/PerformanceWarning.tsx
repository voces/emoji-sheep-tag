import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { styled } from "styled-components";
import { AlertTriangle, X } from "lucide-react";
import { type GpuInfo, gpuInfo as readGpuInfo } from "../../util/gpu.ts";

const DISMISSED_KEY = "emoji-sheep-tag-gpu-warning-dismissed";

const useGPUDetection = (): GpuInfo | null => {
  const [gpuInfo, setGpuInfo] = useState<GpuInfo | null>(null);

  useEffect(() => {
    const info = readGpuInfo();
    if (!info) return;
    setGpuInfo(info);
    if (info.software) console.warn("Software rendering detected!");
  }, []);

  return gpuInfo;
};

const Banner = styled.div`
  position: fixed;
  top: ${({ theme }) => theme.space[5]};
  left: 50%;
  transform: translateX(-50%);
  max-width: 600px;
  text-align: center;
  z-index: 10000;
  background: ${({ theme }) => theme.danger.DEFAULT};
  color: white;
  padding: ${({ theme }) => theme.space[4]} ${({ theme }) => theme.space[6]};
  border-radius: ${({ theme }) => theme.radius.md};
  box-shadow: ${({ theme }) => theme.shadow.lg};
`;

const CloseButton = styled.button`
  position: absolute;
  top: ${({ theme }) => theme.space[2]};
  right: ${({ theme }) => theme.space[2]};
  background: none;
  border: none;
  color: white;
  cursor: pointer;
  padding: ${({ theme }) => theme.space[1]};
  line-height: 1;
  opacity: 0.7;
  transition: opacity ${({ theme }) => theme.motion.fast} ${({ theme }) =>
    theme.motion.easeOut};

  &.hover {
    opacity: 1;
  }
`;

const IconContainer = styled.div`
  margin-bottom: ${({ theme }) => theme.space[2]};
`;

const Title = styled.div`
  font-weight: 700;
  margin-bottom: ${({ theme }) => theme.space[2]};
`;

const Description = styled.div`
  font-size: ${({ theme }) => theme.text.sm};
  margin-bottom: ${({ theme }) => theme.space[3]};
`;

const Steps = styled.div`
  font-size: ${({ theme }) => theme.text.xs};
  margin-bottom: ${({ theme }) => theme.space[3]};
  text-align: left;
  line-height: 1.5;
`;

const InstructionsLink = styled.a`
  display: inline-block;
  background: white;
  color: ${({ theme }) => theme.danger.DEFAULT};
  padding: ${({ theme }) => theme.space[2]} ${({ theme }) => theme.space[4]};
  border-radius: ${({ theme }) => theme.radius.sm};
  text-decoration: none;
  font-weight: 700;
  font-size: ${({ theme }) => theme.text.sm};

  &.hover {
    opacity: 0.9;
  }
`;

const GPULabel = styled.div`
  font-size: ${({ theme }) => theme.text.xs};
  margin-top: ${({ theme }) => theme.space[2]};
  opacity: 0.8;
`;

export const PerformanceWarning = () => {
  const { t } = useTranslation();
  const gpuInfo = useGPUDetection();
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    if (gpuInfo && !gpuInfo.software) {
      localStorage.removeItem(DISMISSED_KEY);
      return;
    }

    const dismissed = localStorage.getItem(DISMISSED_KEY);
    if (dismissed === "true") setIsDismissed(true);
  }, [gpuInfo]);

  const handleDismiss = () => {
    localStorage.setItem(DISMISSED_KEY, "true");
    setIsDismissed(true);
  };

  if (!gpuInfo?.software || isDismissed) return null;

  return (
    <Banner>
      <CloseButton type="button" onClick={handleDismiss}>
        <X size={16} />
      </CloseButton>
      <IconContainer>
        <AlertTriangle size={24} />
      </IconContainer>
      <Title>{t("gpu.title")}</Title>
      <Description>{t("gpu.description")}</Description>
      <Steps>
        <strong>{t("gpu.howToFix")}</strong>
        <br />
        1. {t("gpu.step1")}
        <br />
        2. {t("gpu.step2")}
        <br />
        3. {t("gpu.step3")}
      </Steps>
      <InstructionsLink
        href="https://www.howtogeek.com/412738/how-to-turn-hardware-acceleration-on-and-off-in-chrome/"
        target="_blank"
        rel="noopener noreferrer"
      >
        {t("gpu.seeInstructions")}
      </InstructionsLink>
      <GPULabel>{t("gpu.gpuLabel", { renderer: gpuInfo.renderer })}</GPULabel>
    </Banner>
  );
};
