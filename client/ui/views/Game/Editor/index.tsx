import { VStack } from "@/components/layout/Layout.tsx";
import { useReactiveVar } from "@/hooks/useVar.tsx";
import { editorVar } from "@/vars/editor.ts";
import { DoodadsPanel } from "./DoodadsPanel.tsx";
import { PropertiesPanel } from "./PropertiesPanel.tsx";
import { TerrainPanel } from "./TerrainPanel.tsx";

export const Editor = () => {
  const editor = useReactiveVar(editorVar);

  if (!editor) return null;

  return (
    <VStack>
      <TerrainPanel />
      <DoodadsPanel />
      <PropertiesPanel />
    </VStack>
  );
};
