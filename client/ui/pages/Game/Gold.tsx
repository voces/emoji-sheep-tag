import { styled } from "npm:styled-components";
import { SvgIcon } from "../../components/SVGIcon.tsx";
import { useReactiveVar } from "../../hooks/useVar.tsx";
import { playersVar } from "../../vars/players.ts";
import { Entity } from "../../../ecs.ts";
import { useListenToEntityProp } from "../../hooks/useListenToEntityProp.ts";

const Container = styled.div(({ theme }) => ({
  position: "fixed",
  top: 8,
  right: 0,
  width: 120,
  pointerEvents: "none",
  display: "flex",
  gap: 4,
  alignItems: "center",
  color: theme.colors.gold,
}));

const InnerGold = ({ entity }: { entity: Entity }) => {
  useListenToEntityProp(entity, "gold");

  return (
    <Container>
      <span style={{ width: 24, height: 24 }}>
        <SvgIcon icon="gold" />
      </span>
      <span>{(entity.gold ?? 0).toFixed(0)}</span>
    </Container>
  );
};

export const Gold = () => {
  const players = useReactiveVar(playersVar);
  const playerEntity = players.find((p) => p.local)?.entity;

  if (!playerEntity) return null;

  return <InnerGold entity={playerEntity} />;
};
