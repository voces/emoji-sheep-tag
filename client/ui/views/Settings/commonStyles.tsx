import { styled } from "styled-components";
import { VStack } from "@/components/layout/Layout.tsx";

export const SettingsPanelContainer = styled(VStack)`
  gap: ${({ theme }) => theme.spacing.lg};
  max-height: 100%;
  overflow: auto;
  padding-right: ${({ theme }) => theme.spacing.lg};
  padding-bottom: ${({ theme }) => theme.spacing.lg};
`;

export const SettingsPanelTitle = styled.h3`
  margin: 0;
`;
