import { styled } from "styled-components";

export const SettingsPanelContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.space[4]};
`;

export const SettingsPanelTitle = styled.h3`
  margin: 0 0 ${({ theme }) => theme.space[2]};
  font-size: ${({ theme }) => theme.text.lg};
  font-weight: 600;
  letter-spacing: -0.01em;
  color: ${({ theme }) => theme.ink.hi};
`;

export const FieldGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.space[4]};
`;

export const ToggleGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

export const SettingSectionTitle = styled.h4`
  margin: 0;
  font-size: ${({ theme }) => theme.text.sm};
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: ${({ theme }) => theme.ink.lo};
`;

export const SettingDivider = styled.hr`
  height: 1px;
  background: ${({ theme }) => theme.border.soft};
  border: none;
  margin: 0;
`;
