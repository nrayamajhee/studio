// Exports web-react's patches and master params as data/patches.json, which
// the Rust engine embeds. Run from web-react after changing a patch:
//   npx tsx ../sound-engine/scripts/export-patches.ts
import { writeFileSync } from "node:fs";
import {
  MASTER_PARAMS,
  PATCHES,
} from "../../web-react/app/lib/physical/patches";

const out = new URL("../data/patches.json", import.meta.url);
writeFileSync(
  out,
  JSON.stringify({ patches: PATCHES, master: MASTER_PARAMS }) + "\n",
);
console.log(
  `wrote ${PATCHES.length} patches and ${MASTER_PARAMS.length} master params`,
);
