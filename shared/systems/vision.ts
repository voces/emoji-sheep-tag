import { Entity, SystemEntity } from "@/shared/types.ts";
import { addSystem, appContext } from "@/shared/context.ts";
import { App } from "@verit/ecs";
import { prefabs } from "@/shared/data.ts";
import { getPlayer } from "@/shared/api/player.ts";
import { KdTree } from "@/shared/util/KDTree.ts";
import { Point } from "@/shared/pathing/math.ts";

type VisionEntity = SystemEntity<"position" | "sightRadius" | "owner">;
type Team = "sheep" | "wolf" | "neutral";

// Derive max sight radius from prefab data for KD tree range queries
const allSightRadii = Object.values(prefabs)
  .map((p) => p.sightRadius)
  .filter((r): r is number => typeof r === "number" && r > 0);
export const MAX_SIGHT_RADIUS = Math.max(...allSightRadii);

const getTeam = (owner: string | undefined): Team => {
  if (!owner) return "neutral";
  const player = getPlayer(owner);
  if (player?.team === "sheep") return "sheep";
  if (player?.team === "wolf") return "wolf";
  return "neutral";
};

type VisionData = {
  // KD tree per team for spatial queries
  kdByTeam: Map<Team, KdTree>;
  // Map point references back to entities
  pointToEntity: Map<Point, VisionEntity>;
  // Track entity's current point for updates/removal
  entityToPoint: Map<VisionEntity, Point>;
  // Track entity's current team for updates/removal
  entityToTeam: Map<VisionEntity, Team>;
};

export const visionDataMap = new WeakMap<App<Entity>, VisionData>();

/**
 * Iterate over all vision entities for a team that could potentially see a target point.
 * Uses KD tree for efficient spatial lookup.
 * Yields entities in no particular order - caller should check actual visibility.
 */
export function* iterateViewersInRange(
  team: Team,
  targetX: number,
  targetY: number,
): Generator<VisionEntity> {
  const data = visionDataMap.get(appContext.current);
  if (!data) return;

  const kd = data.kdByTeam.get(team);
  if (!kd) return;

  // Query with max sight radius to get all potential viewers
  for (const point of kd.iterateInRange(targetX, targetY, MAX_SIGHT_RADIUS)) {
    const entity = data.pointToEntity.get(point);
    if (!entity) continue;

    // Filter by actual sight radius
    const dx = entity.position.x - targetX;
    const dy = entity.position.y - targetY;
    const distSq = dx * dx + dy * dy;
    const radiusSq = entity.sightRadius * entity.sightRadius;

    if (distSq <= radiusSq) {
      yield entity;
    }
  }
}

addSystem<Entity, "position" | "sightRadius" | "owner">((app) => {
  const kdByTeam = new Map<Team, KdTree>();
  const pointToEntity = new Map<Point, VisionEntity>();
  const entityToPoint = new Map<VisionEntity, Point>();
  const entityToTeam = new Map<VisionEntity, Team>();

  // Initialize KD trees for each team
  const teams: Team[] = ["sheep", "wolf", "neutral"];
  for (const team of teams) {
    kdByTeam.set(team, new KdTree());
  }

  const data: VisionData = {
    kdByTeam,
    pointToEntity,
    entityToPoint,
    entityToTeam,
  };
  visionDataMap.set(app, data);

  const addEntity = (e: VisionEntity) => {
    const team = getTeam(e.owner);
    const kd = kdByTeam.get(team)!;

    kd.add(e.position);
    pointToEntity.set(e.position, e);
    entityToPoint.set(e, e.position);
    entityToTeam.set(e, team);
  };

  const removeEntity = (e: VisionEntity) => {
    const oldPoint = entityToPoint.get(e);
    const oldTeam = entityToTeam.get(e);
    if (!oldPoint || !oldTeam) return;

    const kd = kdByTeam.get(oldTeam);
    if (kd) kd.delete(oldPoint);

    pointToEntity.delete(oldPoint);
    entityToPoint.delete(e);
    entityToTeam.delete(e);
  };

  return {
    props: ["position", "sightRadius", "owner"],
    onAdd: addEntity,
    onChange: (e) => {
      const oldPoint = entityToPoint.get(e);
      const oldTeam = entityToTeam.get(e);
      const newTeam = getTeam(e.owner);

      if (!oldPoint || !oldTeam) {
        addEntity(e);
        return;
      }

      // Check if team changed
      if (oldTeam !== newTeam) {
        removeEntity(e);
        addEntity(e);
        return;
      }

      // Same team - update position in KD tree
      const kd = kdByTeam.get(oldTeam)!;
      kd.replace(oldPoint, e.position);
      pointToEntity.delete(oldPoint);
      pointToEntity.set(e.position, e);
      entityToPoint.set(e, e.position);
    },
    onRemove: (e) => removeEntity(e as VisionEntity),
  };
});
