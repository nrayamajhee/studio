import type { BusId } from "../messages";
import { banjo } from "./banjo";
import { bass } from "./bass";
import { bassTrumpet } from "./bassTrumpet";
import { cello } from "./cello";
import { clarinet } from "./clarinet";
import { drums, drums808, jazzDrums, rockDrums } from "./drums";
import { electricGuitar } from "./electricGuitar";
import { flute } from "./flute";
import { guitar } from "./guitar";
import { madal, tabla } from "./handDrums";
import { harmonica } from "./harmonica";
import { harmonium } from "./harmonium";
import { harp } from "./harp";
import { kalimba } from "./kalimba";
import { nylonGuitar } from "./nylonGuitar";
import { oscillator } from "./oscillator";
import { piano } from "./piano";
import { saxophone } from "./saxophone";
import { sitar } from "./sitar";
import { steelPan } from "./steelPan";
import { trombone } from "./trombone";
import { trumpet } from "./trumpet";
import type { Patch } from "./types";
import { ukulele } from "./ukulele";
import { uprightBass } from "./uprightBass";
import { violin } from "./violin";
import { xylophone } from "./xylophone";

export { MASTER_PARAMS } from "./params";

export const PATCHES: readonly Patch[] = [
  piano,
  guitar,
  electricGuitar,
  nylonGuitar,
  ukulele,
  banjo,
  bass,
  uprightBass,
  harp,
  sitar,
  violin,
  cello,
  trumpet,
  bassTrumpet,
  trombone,
  saxophone,
  clarinet,
  flute,
  harmonium,
  harmonica,
  xylophone,
  steelPan,
  kalimba,
  drums,
  rockDrums,
  jazzDrums,
  drums808,
  madal,
  tabla,
  oscillator,
];

export const PATCH_BY_ID = Object.fromEntries(
  PATCHES.map((patch) => [patch.id, patch]),
) as Record<BusId, Patch>;
