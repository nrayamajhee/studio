import type { BusId } from "../messages";
import { bass } from "./bass";
import { bassTrumpet } from "./bassTrumpet";
import { cello } from "./cello";
import { drums, drums808 } from "./drums";
import { electricGuitar } from "./electricGuitar";
import { flute } from "./flute";
import { guitar } from "./guitar";
import { madal, tabla } from "./handDrums";
import { harp } from "./harp";
import { nylonGuitar } from "./nylonGuitar";
import { oscillator } from "./oscillator";
import { piano } from "./piano";
import { saxophone } from "./saxophone";
import { trumpet } from "./trumpet";
import type { Patch } from "./types";
import { uprightBass } from "./uprightBass";
import { violin } from "./violin";

export { MASTER_PARAMS } from "./params";

export const PATCHES: readonly Patch[] = [
  piano,
  guitar,
  electricGuitar,
  nylonGuitar,
  bass,
  uprightBass,
  harp,
  violin,
  cello,
  trumpet,
  bassTrumpet,
  saxophone,
  flute,
  drums,
  drums808,
  madal,
  tabla,
  oscillator,
];

export const PATCH_BY_ID = Object.fromEntries(
  PATCHES.map((patch) => [patch.id, patch]),
) as Record<BusId, Patch>;
