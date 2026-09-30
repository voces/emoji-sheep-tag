import { InstancedSvg } from "../graphics/InstancedSvg.ts";
import { loadSvg } from "../graphics/loadSvg.ts";
import { AnimatedInstancedMesh } from "../graphics/AnimatedInstancedMesh.ts";
import { loadEstbModel } from "../graphics/loadEstbModel.ts";
import { estbToSvg } from "../graphics/loadEstb.ts";
import { glow } from "../graphics/glow.ts";
import sheep from "../assets/sheep.estb" with { type: "bytes" };
import wolf from "../assets/wolf.estb" with { type: "bytes" };
import hut from "../assets/hut.svg" with { type: "text" };
import fence from "../assets/fence.svg" with { type: "text" };
import fire from "../assets/fire.svg" with { type: "text" };
import claw from "../assets/claw.svg" with { type: "text" };
import claw2 from "../assets/claw2.svg" with { type: "text" };
import collision from "../assets/collision.svg" with { type: "text" };
import flowers from "../assets/flowers.svg" with { type: "text" };
import suspend from "../assets/suspend.svg" with { type: "text" };
import ring from "../assets/ring.svg" with { type: "text" };
import gravity from "../assets/gravity.svg" with { type: "text" };
import hinduTemple from "../assets/hindu-temple.svg" with { type: "text" };
import route from "../assets/route.svg" with { type: "text" };
import stop from "../assets/stop.svg" with { type: "text" };
import gold from "../assets/gold.svg" with { type: "text" };
import divinity from "../assets/divinity.svg" with { type: "text" };
import shop from "../assets/shop.svg" with { type: "text" };
import fox from "../assets/fox.estb" with { type: "bytes" };
import sapphire from "../assets/sapphire.svg" with { type: "text" };
import runningShoes from "../assets/running-shoes.svg" with { type: "text" };
import purplePotion from "../assets/purple-potion.svg" with { type: "text" };
import meteor from "../assets/meteor.svg" with { type: "text" };
import dash from "../assets/dash.svg" with { type: "text" };
import tree from "../assets/tree.svg" with { type: "text" };
import treeStump from "../assets/treeStump.svg" with { type: "text" };
import flag from "../assets/flag.svg" with { type: "text" };
import square from "../assets/square.svg" with { type: "text" };
import pinkPotion from "../assets/pinkPotion.svg" with { type: "text" };
import rock from "../assets/rock.svg" with { type: "text" };
import house from "../assets/house.svg" with { type: "text" };
import location from "../assets/location.svg" with { type: "text" };
import well from "../assets/well.svg" with { type: "text" };
import windmill from "../assets/windmill.estb" with { type: "bytes" };
import scarecrow from "../assets/scarecrow.svg" with { type: "text" };
import derelictHouse from "../assets/derelictHouse.svg" with { type: "text" };
import barrel from "../assets/barrel.svg" with { type: "text" };
import hayBale from "../assets/hayBale.svg" with { type: "text" };
import wood from "../assets/wood.svg" with { type: "text" };
import bluePotion from "../assets/blue-potion.svg" with { type: "text" };
import sentry from "../assets/sentry.svg" with { type: "text" };
import watchtower from "../assets/watchtower.svg" with { type: "text" };
import bite from "../assets/bite.svg" with { type: "text" };
import castle from "../assets/castle.svg" with { type: "text" };
import frostOrb from "../assets/frostOrb.svg" with { type: "text" };
import sword from "../assets/sword.svg" with { type: "text" };
import attackGround from "../assets/attackGround.svg" with { type: "text" };
import totem from "../assets/totem.svg" with { type: "text" };
import shield from "../assets/shield.svg" with { type: "text" };
import wind from "../assets/wind.svg" with { type: "text" };
import sparkle from "../assets/sparkle.svg" with { type: "text" };
import rune from "../assets/rune.svg" with { type: "text" };
import rune2 from "../assets/rune2.svg" with { type: "text" };
import atom from "../assets/atom.svg" with { type: "text" };
import swap from "../assets/swap.svg" with { type: "text" };
import scythe from "../assets/scythe.svg" with { type: "text" };
import fangs from "../assets/fangs.svg" with { type: "text" };
import direCollar from "../assets/direCollar.svg" with { type: "text" };
import crimsonArc from "../assets/crimsonArc.svg" with { type: "text" };
import cancel from "../assets/cancel.svg" with { type: "text" };
import vip from "../assets/vip.svg" with { type: "text" };
import wolfDodge from "../assets/wolf-dodge.svg" with { type: "text" };
import construction from "../assets/construction.svg" with { type: "text" };
import bird1 from "../assets/bird1.estb" with { type: "bytes" };
import bird2 from "../assets/bird2.estb" with { type: "bytes" };
import bee from "../assets/bee.svg" with { type: "text" };
import alignment from "../assets/alignment.svg" with { type: "text" };
import crystal from "../assets/crystal.estb" with { type: "bytes" };
import sparkle2 from "../assets/sparkle2.svg" with { type: "text" };
import shack from "../assets/shack.svg" with { type: "text" };
import cabin from "../assets/cabin.svg" with { type: "text" };
import cottage from "../assets/cottage.svg" with { type: "text" };
import hayPile from "../assets/hayPile.svg" with { type: "text" };
import hayCube from "../assets/hayCube.svg" with { type: "text" };
import brokenHayCube from "../assets/brokenHayCube.svg" with { type: "text" };
import beam from "../assets/beam.svg" with { type: "text" };
import beamStart from "../assets/beamStart.svg" with { type: "text" };
import startLocation from "../assets/startLocation.estb" with { type: "bytes" };
import eye from "../assets/eye.svg" with { type: "text" };
import monolith from "../assets/monolith.svg" with { type: "text" };
import circle from "../assets/circle.svg" with { type: "text" };
import crate from "../assets/crate.svg" with { type: "text" };
import cart from "../assets/cart.svg" with { type: "text" };
import wagon from "../assets/wagon.svg" with { type: "text" };
import up from "../assets/up.svg" with { type: "text" };
import down from "../assets/down.svg" with { type: "text" };
import left from "../assets/left.svg" with { type: "text" };
import right from "../assets/right.svg" with { type: "text" };

export const svgs: Record<string, string> = {
  // units
  sheep: estbToSvg(sheep.buffer),
  wolf: estbToSvg(wolf.buffer),
  fox: estbToSvg(fox.buffer),
  startLocation: estbToSvg(startLocation.buffer),

  // structures
  hut,
  shack,
  cabin,
  cottage,
  house,
  hinduTemple,
  divinity,
  sentry,
  watchtower,
  castle,
  totem,
  crystal: estbToSvg(crystal.buffer),
  monolith,

  // items
  claw,
  claw2,
  runningShoes,
  purplePotion,
  meteor,
  pinkPotion,
  bluePotion,
  scythe,
  fangs,
  direCollar,
  hayCube,
  brokenHayCube,
  beamStart,

  // actions
  bite,
  construction,
  shop,
  stop,
  sword,
  attackGround,
  wolfDodge,
  eye,
  suspend,
  cancel,
  route,
  swap,
  alignment,
  up,
  down,
  left,
  right,

  // misc
  gold,

  // doodads
  tree,
  treeStump,
  fence,
  flowers,
  rock,
  well,
  windmill: estbToSvg(windmill.buffer),
  scarecrow,
  derelictHouse,
  barrel,
  hayBale,
  wood,
  hayPile,
  bird1: estbToSvg(bird1.buffer),
  bird2: estbToSvg(bird2.buffer),
  bee,
  crate,
  cart,
  wagon,

  // effects (buffs + sfx)
  crimsonArc,
  flag,
  circle,
  fire,
  collision,
  ring,
  gravity,
  sapphire,
  dash,
  location,
  shield,
  wind,
  rune,
  rune2,
  vip,
  sparkle,
  sparkle2,
  frostOrb,

  // misc
  square,
  atom,
};

type SvgConfig = {
  type: "svg";
  svg: string;
  scale: number;
  options?: Parameters<typeof loadSvg>[2];
};

type EstmeConfig = {
  type: "estme";
  data: ArrayBuffer;
  options?: Omit<Parameters<typeof loadEstbModel>[2], "zOrder">;
};

export type ModelCollection = InstancedSvg | AnimatedInstancedMesh;

type PrebuiltConfig = { type: "prebuilt"; collection: ModelCollection };

type ModelConfig = SvgConfig | EstmeConfig | PrebuiltConfig;

const svg = (
  svgText: string,
  scale: number,
  options?: Parameters<typeof loadSvg>[2],
): SvgConfig => ({ type: "svg", svg: svgText, scale, options });

const estme = (
  data: ArrayBuffer,
  scale: number,
  options?: Omit<Parameters<typeof loadEstbModel>[2], "scale" | "zOrder">,
): EstmeConfig => ({ type: "estme", data, options: { ...options, scale } });

const prebuilt = (collection: ModelCollection): PrebuiltConfig => ({
  type: "prebuilt",
  collection,
});

const modelConfigs = {
  // World sprites sort by position: whichever stands further south draws in
  // front. Order here only breaks ties and orders the see-through pass.
  flowers: svg(flowers, 0.25, { layer: 2 }),
  treeStump: svg(treeStump, 0.11, {
    layer: 2,
    yOffset: -0.36,
    xOffset: -0.01,
  }),
  rock: svg(rock, 0.6, { layer: 2 }),
  fence: svg(fence, 0.07, { layer: 2 }),
  well: svg(well, 0.13, { layer: 2 }),
  scarecrow: svg(scarecrow, 0.14, { layer: 2 }),
  derelictHouse: svg(derelictHouse, 3.5, { layer: 2 }),
  barrel: svg(barrel, 0.14, { layer: 2 }),
  hayBale: svg(hayBale, 0.31, { layer: 2, xOffset: -0.05, yOffset: -0.1 }),
  wood: svg(wood, 0.12, { layer: 2 }),
  crate: svg(crate, 0.6, { layer: 2 }),
  cart: svg(cart, 0.13, { layer: 2, yOffset: 0.2 }),
  wagon: svg(wagon, 0.13, { layer: 2 }),
  glow: prebuilt(glow),

  sentry: svg(sentry, 0.03),
  sheep: estme(sheep.buffer, 0.0005),

  hayPile: svg(hayPile, 0.12, { layer: 2 }),

  // Basic units and structures
  hut: svg(hut, 2),
  house: svg(house, 0.14),
  shack: svg(shack, 0.04),
  cabin: svg(cabin, 0.085),
  cottage: svg(cottage, 0.17),
  watchtower: svg(watchtower, 0.06),
  divinity: svg(divinity, 1.1),
  castle: svg(castle, 0.7),
  monolith: svg(monolith, 0.13, { yOffset: 0.05 }),
  fox: estme(fox.buffer, 0.0088),
  wolf: estme(wolf.buffer, 0.01),

  windmill: estme(windmill.buffer, 0.0033, {
    layer: 2,
    yOffset: 0.1,
    xOffset: -0.1,
  }),
  tree: svg(tree, 0.11, { layer: 2, yOffset: 0.2 }),
  totem: svg(totem, 0.18, { yOffset: 0.12 }),
  crystal: estme(crystal.buffer, 0.014, { yOffset: 0.2 }),
  hayCube: svg(hayCube, 0.05),
  brokenHayCube: svg(brokenHayCube, 0.05),

  // Overlays draw over every sprite, in this order
  // Temple stacks on things, we want it visible, always
  hinduTemple: svg(hinduTemple, 1.9, { overlay: true }),
  atom: svg(atom, 0.05, { overlay: true }),
  startLocation: estme(startLocation.buffer, 0.25, { overlay: true }),

  bird1: estme(bird1.buffer, 0.004, { layer: 2, overlay: true }),
  bird2: estme(bird2.buffer, 0.004, { layer: 2, overlay: true }),
  bee: svg(bee, 0.17, { layer: 2, overlay: true }),

  // SFX elements
  shield: svg(shield, 1, { layer: 2, overlay: true }),
  wind: svg(wind, 1, { layer: 2, overlay: true }),
  sparkle: svg(sparkle, 1, { layer: 2, overlay: true }),
  sparkle2: svg(sparkle2, 0.2, { layer: 2, overlay: true }),
  rune: svg(rune, 0.4, { layer: 2, overlay: true }),
  rune2: svg(rune2, 0.05, { layer: 2, overlay: true }),
  eye: svg(eye, 0.05, { layer: 2, overlay: true }),
  swap: svg(swap, 0.1, { layer: 2, overlay: true }),
  circle: svg(circle, 0.08, { layer: 2, overlay: true }),
  fire: svg(fire, 1, { layer: 2, overlay: true }),
  crimsonArc: svg(crimsonArc, 0.1, { layer: 2, overlay: true }),
  vip: svg(vip, 0.03, { layer: 2, overlay: true }),
  claw: svg(claw, 0.05, { layer: 2, overlay: true }),
  dash: svg(dash, 0.1, { layer: 2, overlay: true }),
  flag: svg(flag, 1, { layer: 2, overlay: true, yOffset: 0.15, xOffset: 0.09 }),
  location: svg(location, 2, { layer: 2, overlay: true }),
  collision: svg(collision, 2, { layer: 2, overlay: true }),
  meteor: svg(meteor, 0.5, {
    layer: 2,
    overlay: true,
    yOffset: 0.7,
    xOffset: 0.08,
  }),
  beamStart: svg(beamStart, 0.25, { layer: 2, overlay: true, xOffset: 0.75 }),
  beam: svg(beam, 0.5, { layer: 2, overlay: true, xOffset: -3 }),
  frostOrb: svg(frostOrb, 0.4, { layer: 2, overlay: true }),
  square: svg(square, 1, { layer: 2, overlay: true }),

  // Top-layer indicators (render above everything)
  ring: svg(ring, 0.08, { layer: 2, overlay: true }),
  gravity: svg(gravity, 2, { layer: 2, overlay: true }),
} satisfies Record<string, ModelConfig>;

type ModelName = keyof typeof modelConfigs;

const isModelName = (model: PropertyKey): model is ModelName =>
  Object.hasOwn(modelConfigs, model);

// Render orders follow declaration order in modelConfigs
const modelRenderOrders = new Map(
  Object.keys(modelConfigs).map((key, index) => [key, index]),
);

const loadCollection = (model: ModelName): ModelCollection => {
  const config: ModelConfig = modelConfigs[model];
  if (config.type === "prebuilt") return config.collection;
  const zOrder = modelRenderOrders.get(model)!;
  return config.type === "estme"
    ? loadEstbModel(config.data, model, { ...config.options, zOrder })
    : loadSvg(config.svg, config.scale, config.options, zOrder);
};

const loadedCollections = new Map<ModelName, ModelCollection>();

const getCollection = (model: PropertyKey): ModelCollection | undefined => {
  if (!isModelName(model)) return;
  let collection = loadedCollections.get(model);
  if (!collection) {
    collection = loadCollection(model);
    loadedCollections.set(model, collection);
  }
  return collection;
};

export const getModelScale = (model: string): number | undefined => {
  if (!isModelName(model)) return;
  const config: ModelConfig = modelConfigs[model];
  return config.type === "svg" ? config.scale : undefined;
};

export const collections: Record<string, ModelCollection | undefined> =
  new Proxy(
    {} as Record<string, ModelCollection | undefined>,
    { get: (_target, prop) => getCollection(prop) },
  );
Object.assign(globalThis, { collections });
