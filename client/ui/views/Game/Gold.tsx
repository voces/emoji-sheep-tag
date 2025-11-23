import { styled } from "styled-components";
import { SvgIcon } from "@/components/SVGIcon.tsx";
import { useReactiveVar } from "@/hooks/useVar.tsx";
import { useLocalPlayer } from "@/hooks/usePlayers.ts";
import { Entity } from "../../../ecs.ts";
import { useListenToEntityProp } from "@/hooks/useListenToEntityProp.ts";
import { editorVar } from "@/vars/editor.ts";

const Container = styled.div(({ theme }) => ({
  width: 120,
  display: "flex",
  gap: 4,
  alignItems: "center",
  color: theme.colors.gold,
}));

const InnerGold = ({ entity }: { entity: Entity }) => {
  const gold = useListenToEntityProp(entity, "gold", (g) => Math.floor(g ?? 0));

  return (
    <Container>
      <span style={{ width: 24, height: 24 }}>
        <SvgIcon icon="gold" />
      </span>
      <span>{gold}</span>
    </Container>
  );
};

export const Gold = () => {
  const editor = useReactiveVar(editorVar);
  const player = useLocalPlayer();

  if (!player || editor) return null;

  return <InnerGold entity={player} />;
};
