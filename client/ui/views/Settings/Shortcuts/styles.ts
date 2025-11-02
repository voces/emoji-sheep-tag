import { styled } from "styled-components";
import { Input } from "@/components/forms/Input.tsx";

export const ShortcutInput = styled(Input)`
  width: 100%;
  max-width: 150px;
`;

export const ConflictWarningContainer = styled.div`
  color: ${({ theme }) => theme.colors.orange};
  font-size: 0.85em;
  margin-top: 4px;
  padding: 4px 8px;
  background: rgba(255, 165, 0, 0.1);
  border-radius: 2px;
`;
