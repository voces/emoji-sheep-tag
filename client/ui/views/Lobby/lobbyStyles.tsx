import { styled } from "styled-components";
import { VStack } from "@/components/layout/Layout.tsx";
import { Card } from "@/components/layout/Card.tsx";

export {
  ToggleButton as ModeButton,
  ToggleGroup as ButtonGroup,
} from "@/components/forms/ToggleGroup.tsx";

export const SettingsCard = styled(Card)`
  width: 40%;
  justify-content: space-between;
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.space[4]};
`;

export const GameSettingsContainer = styled(VStack)`
  gap: ${({ theme }) => theme.space[2]};
`;

export const SettingsRow = styled(VStack)`
  gap: 2px;
`;

export const SettingsHeader = styled.h3`
  margin: 0;
  font-size: ${({ theme }) => theme.text.lg};
  font-weight: 600;
`;

export const SettingsLabel = styled.label`
  font-size: ${({ theme }) => theme.text.sm};
  font-weight: 600;
`;
