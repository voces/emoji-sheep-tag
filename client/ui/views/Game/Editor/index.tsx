import { VStack } from "@/components/layout/Layout.tsx";
import { useReactiveVar } from "@/hooks/useVar.tsx";
import { editorVar } from "@/vars/editor.ts";
import { DoodadsPanel } from "./DoodadsPanel.tsx";
import { PropertiesPanel } from "./PropertiesPanel.tsx";
import { TerrainPanel } from "./TerrainPanel.tsx";
import { AreaPanel } from "./AreaPanel.tsx";

export const Editor = () => {
  const editor = useReactiveVar(editorVar);

  if (!editor) return null;

  return (
    <VStack>
      <AreaPanel />
      <TerrainPanel />
      <DoodadsPanel />
      <PropertiesPanel />
    </VStack>
  );
};
