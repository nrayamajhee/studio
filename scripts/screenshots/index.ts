// Shoots the docs' pictures of the Device in the light and dark themes, into
// public/docs/<set>/<name>.webp and <name>.dark.webp. Needs the app running
// (`npm run dev`); run `npm run screenshots`, or name sets to shoot only
// those (`npm run screenshots -- the-device --dark`).
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { driveDevice, type Device, type Theme } from "./device";
import synthEngine from "./synth-engine";
import theDevice from "./the-device";
import userManual from "./user-manual";

const SETS: Record<string, (device: Device) => Promise<void>> = {
  "user-manual": userManual,
  "the-device": theDevice,
  "synth-engine": synthEngine,
};

const url = process.env.STUDIO_URL ?? "http://localhost:3000/";
const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const args = process.argv.slice(2);
const sets = args.filter((arg) => arg in SETS);
const themes: Theme[] = args.includes("--light")
  ? ["light"]
  : args.includes("--dark")
    ? ["dark"]
    : ["light", "dark"];

const browser = await chromium.launch({
  args: ["--autoplay-policy=no-user-gesture-required"],
});

// The browser's own WebP encoder, so the script needs no image library.
const converter = await browser.newPage();
const encode = async (png: Buffer) =>
  Buffer.from(
    await converter.evaluate(async (base64) => {
      const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
      const bitmap = await createImageBitmap(
        new Blob([bytes], { type: "image/png" }),
      );
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
      canvas.getContext("2d")?.drawImage(bitmap, 0, 0);
      const blob = await canvas.convertToBlob({
        type: "image/webp",
        quality: 0.85,
      });
      const webp = new Uint8Array(await blob.arrayBuffer());
      let binary = "";
      for (const byte of webp) binary += String.fromCharCode(byte);
      return btoa(binary);
    }, png.toString("base64")),
    "base64",
  );

try {
  for (const set of sets.length ? sets : Object.keys(SETS)) {
    for (const theme of themes) {
      // A fresh browser profile each time, so every set starts from the
      // Device as it comes.
      const context = await browser.newContext({
        viewport: { width: 1240, height: 1100 },
        deviceScaleFactor: 1.25,
        colorScheme: theme,
      });
      // Off a Mac, so the keycaps read Ctrl S as the docs do.
      await context.addInitScript((theme) => {
        localStorage.setItem("theme", JSON.stringify(theme));
        Object.defineProperty(navigator, "platform", { value: "Linux x86_64" });
      }, theme);
      const device = driveDevice(await context.newPage(), {
        url,
        out: join(root, "public/docs", set),
        theme,
        encode,
      });
      await device.open();
      await SETS[set](device);
      await context.close();
    }
  }
} finally {
  await browser.close();
}
