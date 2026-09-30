import type { BusId } from "../messages";
import { bass } from "./bass";
import { drums, drums808 } from "./drums";
import { flute } from "./flute";
import { guitar } from "./guitar";
import { piano } from "./piano";
import { saxophone } from "./saxophone";
import type { Patch } from "./types";
import { uprightBass } from "./uprightBass";
import { violin } from "./violin";

export { MASTER_PARAMS } from "./params";

export const PATCHES: readonly Patch[] = [
  piano,
  guitar,
  bass,
  uprightBass,
  violin,
  saxophone,
  flute,
  drums,
  drums808,
];

export const PATCH_BY_ID = Object.fromEntries(
  PATCHES.map((patch) => [patch.id, patch]),
) as Record<BusId, Patch>;
