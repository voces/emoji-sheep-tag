import { VStack } from "@/components/layout/Layout.tsx";
import { useReactiveVar } from "@/hooks/useVar.tsx";
import { editorVar } from "@/vars/editor.ts";
import { DoodadsPanel } from "./DoodadsPanel.tsx";
import { PropertiesPanel } from "./PropertiesPanel.tsx";
import { TerrainPanel } from "./TerrainPanel.tsx";
import { AreaPanel } from "./AreaPanel.tsx";
import { styled } from "styled-components";

const Container = styled(VStack)`
  max-height: calc(100vh - ${({ theme }) => theme.space[2]} * 2);
  width: 260px;
  gap: ${({ theme }) => theme.space[2]};
`;

export const Editor = () => {
  const editor = useReactiveVar(editorVar);

  if (!editor) return null;

  return (
    <Container>
      <AreaPanel />
      <TerrainPanel />
      <DoodadsPanel />
      <PropertiesPanel />
    </Container>
  );
};
