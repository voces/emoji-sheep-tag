import { App } from "@verit/ecs";
import { Entity } from "@/shared/types.ts";
import { PathingMap } from "@/shared/pathing/PathingMap.ts";
import { PathingEntity, TargetEntity } from "@/shared/pathing/types.ts";
import { lookup } from "./lookup.ts";
import {
  getTerrainLayers,
  getTerrainPathingMap,
  onMapChange,
} from "@/shared/map.ts";
import { isPathingEntity } from "@/shared/pathing/util.ts";
import { isAlly } from "@/shared/api/unit.ts";
import { angleDifference } from "@/shared/pathing/math.ts";
import { addSystem, appContext } from "@/shared/context.ts";

const pathingMaps = new WeakMap<App<Entity>, PathingMap>();

export const pathingMap = () => {
  const pathingMap = pathingMaps.get(appContext.current);
  if (!pathingMap) throw new Error("Expected there to be a pathingmap");
  return pathingMap;
};

export const withPathingMap = <T>(fn: (pathingMap: PathingMap) => T) =>
  fn(pathingMap());

/**
 * An ally on the move is passing through and will clear, so a path may be drawn
 * straight through where it stands. An enemy is not: routing through one only
 * to be stopped by it means re-drawing the path every time, which is what makes
 * a unit walked into by an enemy jitter rather than go round. Whatever is being
 * chased is exempt — a path to something is meant to end at it.
 */
const solidWhileMoving = (entity: Entity, target?: Entity) => (other: Entity) =>
  other !== target && !isAlly(entity, other);

export const calcPath = (
  entity: Entity,
  target: string | { x: number; y: number },
  { distanceFromTarget, lead, removeMovingEntities }: {
    distanceFromTarget?: number;
    lead?: boolean;
    removeMovingEntities?: boolean;
  } = {},
) => {
  if (!isPathingEntity(entity)) return [];
  if (!pathingMap().pathable(entity)) return [];
  if (typeof entity.movementSpeed !== "number") return [];
  if (typeof target === "string") {
    const targetEntity = lookup(target);
    if (!targetEntity?.position) return [];

    // Default lead to true for entity targets
    const shouldLead = lead ?? true;

    try {
      const path = pathingMap().path(
        entity,
        targetEntity as TargetEntity,
        {
          distanceFromTarget: shouldLead
            ? Math.max(
              0,
              (distanceFromTarget ?? entity.attack?.range ?? 0) -
                (targetEntity.order?.type === "walk"
                  ? (targetEntity.movementSpeed ?? 0) * 0.2
                  : 0),
            )
            : distanceFromTarget,
          removeMovingEntities,
          keepMoving: solidWhileMoving(entity, targetEntity),
        },
      ).slice(1);

      if (
        path.at(-1)?.x === entity.position.x &&
        path.at(-1)?.y === entity.position.y
      ) path.pop();

      return path;
    } catch {
      return [];
    }
  }

  // Extract only {x, y} from target to avoid passing extra properties
  // (e.g., order objects have type, unitType, path etc. that shouldn't be in the path)
  const path = pathingMap().path(
    entity,
    { x: target.x, y: target.y },
    {
      distanceFromTarget,
      removeMovingEntities,
      keepMoving: solidWhileMoving(entity),
    },
  ).slice(1);

  if (
    path.at(-1)?.x === entity.position.x &&
    path.at(-1)?.y === entity.position.y
  ) path.pop();

  return path;
};

export const pathable = (
  entity: Entity,
  target?: { x: number; y: number },
) => {
  if (!isPathingEntity(entity)) return true;
  return pathingMap().pathable(entity, target?.x, target?.y);
};

export const blockers = (
  entity: Entity,
  target?: { x: number; y: number },
): Entity[] => {
  if (!isPathingEntity(entity)) return [];
  return pathingMap().blockers(entity, target?.x, target?.y);
};

export const nearestPathing = (
  entity: Entity,
  target: { x: number; y: number },
) => {
  if (!isPathingEntity(entity)) return target;
  const pm = pathingMap();
  // TODO: withoutEntity required?
  return pm.withoutEntity(
    entity,
    () => pm.nearestPathing(target.x, target.y, entity),
  );
};

/**
 * How far along a wide a builder is set past the middle of what it just laid,
 * or behind it where that is negative.
 *
 * A wide steps the same square across whatever is being laid, but a structure
 * sets the builder out across it by its own size, leaving a house further from
 * the next site than a cottage. Leading by the difference, twice over, evens
 * that out; a cottage, being the smallest a wide is laid from, needs none.
 */
const slideLead = (extent: number) => (extent - WIDE_EXTENT) * 2;

/**
 * How far either side of a corner an approach still counts as coming at it, and
 * so is carried round the structure at all. More room is given on the side the
 * turn carries toward than against it: having been carried once, a builder
 * meets the next structure a little short of its corner, and that alone should
 * not count as coming at one.
 */
const SPIN_WITH_TURN = 30 * Math.PI / 180;
const SPIN_AGAINST_TURN = 10 * Math.PI / 180;

/** What a build position snaps to, and so the most a wide steps sideways. */
const BUILD_GRID_STEP = 0.5;

/** Half the width of the smallest structure a wide is laid from: a cottage. */
const WIDE_EXTENT = 0.75;

/** Eight ways to come at a structure: the four faces and the four corners. */
const COMPASS_STEP = Math.PI / 4;

/**
 * How far round a structure a builder is carried from where it came at it, in
 * cells, always the same way about. Without it, massing a lattice always sets
 * the builder in the hole between four and there is nothing to choose between
 * laying the left of a pair first or the right.
 */
const SPIN_CELLS = 1;

/** Half the width of an entity's footprint, in world units. */
const footprintExtent = (entity: Entity, resolution: number) =>
  entity.tilemap
    ? Math.max(entity.tilemap.width, entity.tilemap.height) / 2 / resolution
    : entity.radius ?? 0;

/**
 * Moves a builder out of the structure it just placed, setting it down on the
 * face ahead of it along the wide it is laying. Landing behind means walking
 * back around the structure to reach the next site, which is what stops a wide
 * from going up in one pass; landing ahead leaves the builder already within
 * range of it.
 */
export const displaceThrough = (
  entity: Entity,
  structure: Entity,
  previousSite?: { x: number; y: number },
) => {
  const p = pathingMap();
  if (!isPathingEntity(entity) || !structure.position) return;

  // Placed every time, not only when the structure landed on top of it. A
  // builder can finish just inside or just outside a small footprint depending
  // on the angle it came in at, and letting that decide whether it is placed at
  // all makes the same build put it in two different spots.

  // Exactly clear of the footprint, no further: for a corner approach any
  // margin here is multiplied by the diagonal and leaves the builder visibly
  // adrift of what it just built.
  const clearance = footprintExtent(structure, p.resolution) +
    (entity.radius ?? 0);

  // The line between consecutive sites is the wide being laid, and the builder
  // leaves by the face ahead along it. Only a structure placed against the last
  // one continues a wide: something put up earlier and elsewhere says nothing
  // about where this builder is headed, and steering by it would set the
  // builder down on a side it never walked, which reads as a blink.
  const width = footprintExtent(structure, p.resolution) * 2;
  const chainX = previousSite ? structure.position.x - previousSite.x : 0;
  const chainY = previousSite ? structure.position.y - previousSite.y : 0;

  // Only the structures a wide is laid from carry a builder along one. Smaller
  // ones sit close enough to the line that they would carry it faster than the
  // large ones do, which is backwards, and they are not what a wide is made of.
  const laysWides = footprintExtent(structure, p.resolution) >= WIDE_EXTENT;

  // A wide steps a full footprint along one axis and a single square of the
  // build grid along the other — one square whatever is being laid, since the
  // grid does not grow with the structure. Anything else — two squares over, a
  // structure set diagonally against this one, or one put up somewhere else
  // entirely — is not a line being laid, and must not say where the builder
  // goes.
  const major = Math.max(Math.abs(chainX), Math.abs(chainY));
  const minor = Math.min(Math.abs(chainX), Math.abs(chainY));
  const chained = laysWides && major >= width * 0.75 &&
    major <= width * 1.25 && minor <= BUILD_GRID_STEP;

  const offsetX = entity.position.x - structure.position.x;
  const offsetY = entity.position.y - structure.position.y;

  // Laying a wide, the builder is set beside the structure it just placed, on
  // the side of the line it is already on and level with the middle of it. That
  // is a structure's worth of ground gained each time without ever crossing the
  // line, or being carried past the end of what it just built.
  //
  // Off a wide there is no line to travel, so it is only pushed clear along the
  // ray it walked in on, which can never set it down opposite where it stood.
  let seedX: number;
  let seedY: number;

  if (chained) {
    const alongX = Math.abs(chainX) > Math.abs(chainY);
    const ahead = slideLead(footprintExtent(structure, p.resolution));
    seedX = alongX
      ? Math.sign(chainX) * ahead
      : (Math.sign(offsetX) || 1) * clearance;
    seedY = alongX
      ? (Math.sign(offsetY) || 1) * clearance
      : Math.sign(chainY) * ahead;
  } else {
    if (!offsetX && !offsetY) return updatePathing(entity);

    // Snapped to one of eight, so that the spot is decided by which way the
    // builder came at it and not by exactly where along the approach a tick
    // happened to leave it. Otherwise the same build, walked the same way, puts
    // the builder somewhere slightly different every time.
    const approach = Math.atan2(offsetY, offsetX);
    const towardX = Math.cos(approach);
    const towardY = Math.sin(approach);
    const reach = clearance /
      Math.max(Math.abs(towardX), Math.abs(towardY));

    // A builder that came at a corner is carried one cell round the structure,
    // always the same way about. Set down exactly where it came from it ends in
    // the hole between four, and it makes no odds which of a pair it laid
    // first; a consistent turn makes one order of laying them better than the
    // other. Carried round the footprint itself, not round a circle about it,
    // so that it stays against the structure rather than drifting off a corner.
    const nearestCorner =
      Math.round((approach - COMPASS_STEP) / (COMPASS_STEP * 2)) *
        COMPASS_STEP * 2 + COMPASS_STEP;
    const offCorner = angleDifference(nearestCorner, approach);
    const carried = offCorner <= SPIN_WITH_TURN &&
      offCorner >= -SPIN_AGAINST_TURN;
    const spin = carried ? SPIN_CELLS / p.resolution : 0;
    const spunX = towardX * reach - towardY * spin;
    const spunY = towardY * reach + towardX * spin;
    const back = clearance / Math.max(Math.abs(spunX), Math.abs(spunY));

    seedX = spunX * back;
    seedY = spunY * back;
  }

  entity.position = p.withoutEntity(
    entity,
    () =>
      p.nearestSpiralPathing(
        structure.position!.x + seedX,
        structure.position!.y + seedY,
        entity,
        p.layer(entity.position.x, entity.position.y),
      ),
  );
};

export const updatePathing = (entity: Entity, max = Infinity) => {
  const p = pathingMap();
  if (!isPathingEntity(entity)) return;
  if (p.pathable(entity)) return;
  const nearest = p.withoutEntity(
    entity,
    () => p.nearestSpiralPathing(entity.position.x, entity.position.y, entity),
  );
  if (
    (nearest.x !== entity.position.x || nearest.y !== entity.position.y) &&
    ((nearest.x - entity.position.x) ** 2 +
            (nearest.y - entity.position.y) ** 2) ** 0.5 < max
  ) entity.position = nearest;
};

addSystem((app) => {
  const createPathingMap = () =>
    new PathingMap({
      resolution: 4,
      tileResolution: 2,
      pathing: getTerrainPathingMap(),
      layers: getTerrainLayers(),
    });

  let pathingMap = createPathingMap();
  pathingMaps.set(app, pathingMap);

  const rebuildPathingMap = () => {
    pathingMap = createPathingMap();
    pathingMaps.set(app, pathingMap);
  };

  appContext.with(app, () => onMapChange(rebuildPathingMap));

  return {
    props: ["position", "radius"],
    onAdd: (e) => {
      pathingMap.addEntity(e);
      if (e.pathing) updatePathing(e);
    },
    onChange: (e) => {
      pathingMap.updateEntity(e);
      if (e.pathing) updatePathing(e);
    },
    onRemove: (e) => pathingMap.removeEntity(e as PathingEntity),
    update: () => pathingMap.resetPathingStats(),
  };
});

const tilemapsEqual = (
  a: Entity["tilemap"],
  b: Entity["tilemap"],
): boolean => {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.top === b.top &&
    a.left === b.left &&
    a.height === b.height &&
    a.width === b.width &&
    a.map.length === b.map.length &&
    a.map.every((v, i) => v === b.map[i]);
};

addSystem(() => {
  const tilemaps = new WeakMap<Entity, Entity["tilemap"]>();

  return {
    props: ["tilemap"],
    onAdd: (e) => {
      tilemaps.set(e, e.tilemap);
    },
    onChange: (e) => {
      if (!e.position) return;
      const prev = tilemaps.get(e);
      if (tilemapsEqual(prev, e.tilemap)) return;
      tilemaps.set(e, e.tilemap);
      pathingMap().removeEntity(e);
      pathingMap().addEntity(e as PathingEntity);
    },
  };
});
