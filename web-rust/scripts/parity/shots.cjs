// Screenshots web-react and web-rust after the same steps, in both themes,
// and counts the pixels that differ (by more than 24 across the channels),
// comparing them on canvases in the browser. Each pair and a diff
// (differences in red) go to target/parity-shots at the repo's root, or
// `--out`.
//   node web-rust/scripts/parity/shots.cjs <cases.json> [case...] [--out=<folder>]
// A cases file names lists of steps (see common.cjs); a case may set
// `target` (what to shoot, the Device unless set), `viewport`, `fakeMidi`
// (a stand-in controller's name), `drop` (elements one app has and the
// other hasn't, removed before the shot with the separator after them) and
// `allow`. That's how many pixels may differ, 64 unless set: anti-aliasing
// alone moves a few dozen, a glyph or icon's edge or a column of the
// grille's dots, some from run to run, some where web-react writes a
// readout as several text nodes and web-rust as one, a few hundredths of a
// pixel apart.
const { mkdirSync, readFileSync, writeFileSync } = require("node:fs");
const path = require("node:path");
const { APPS, act, launch, open } = require("./common.cjs");

// Animations and transitions stopped, so both are shot at rest.
const STILL =
  ".animate-sunset-traverse{animation:none!important} *{transition:none!important;animation-duration:0s!important}";

// The two shots compared in a page of their own.
async function compare(browser, a, b) {
  const page = await browser.newPage();
  const result = await page.evaluate(
    async ([a, b]) => {
      const load = (data) =>
        new Promise((resolve) => {
          const image = new Image();
          image.onload = () => resolve(image);
          image.src = `data:image/png;base64,${data}`;
        });
      const [one, two] = await Promise.all([load(a), load(b)]);
      if (one.width !== two.width || one.height !== two.height)
        return { sizes: [one.width, one.height, two.width, two.height] };
      const canvas = document.createElement("canvas");
      canvas.width = one.width;
      canvas.height = one.height;
      const context = canvas.getContext("2d");
      const pixels = (image) => {
        context.clearRect(0, 0, image.width, image.height);
        context.drawImage(image, 0, 0);
        return context.getImageData(0, 0, image.width, image.height);
      };
      const [p, q] = [pixels(one), pixels(two)];
      let count = 0;
      for (let i = 0; i < p.data.length; i += 4) {
        const differ =
          Math.abs(p.data[i] - q.data[i]) +
            Math.abs(p.data[i + 1] - q.data[i + 1]) +
            Math.abs(p.data[i + 2] - q.data[i + 2]) >
          24;
        if (differ) count++;
        p.data[i] = differ ? 255 : p.data[i] / 3;
        p.data[i + 1] = differ ? 0 : p.data[i + 1] / 3;
        p.data[i + 2] = differ ? 0 : p.data[i + 2] / 3;
        p.data[i + 3] = 255;
      }
      context.putImageData(p, 0, 0);
      return { count, diff: canvas.toDataURL("image/png").split(",")[1] };
    },
    [a.toString("base64"), b.toString("base64")],
  );
  await page.close();
  return result;
}

(async () => {
  const args = process.argv.slice(2);
  const [file, ...names] = args.filter((arg) => !arg.startsWith("--"));
  const out =
    args.find((arg) => arg.startsWith("--out="))?.slice(6) ??
    path.join(__dirname, "../../../target/parity-shots");
  const cases = Object.entries(JSON.parse(readFileSync(file, "utf8"))).filter(
    ([name]) => names.length === 0 || names.includes(name),
  );
  mkdirSync(out, { recursive: true });
  const browser = await launch();
  let failures = 0;
  for (const [name, test] of cases) {
    const { steps, target, viewport, fakeMidi, drop = [], allow = 64 } = test;
    for (const colorScheme of ["dark", "light"]) {
      const shots = {};
      for (const [app, url] of Object.entries(APPS)) {
        const page = await open(browser, url, {
          viewport: viewport ?? { width: 1100, height: 900 },
          colorScheme,
          midi: fakeMidi,
        });
        await page.addStyleTag({ content: STILL });
        for (const step of steps) await act(page, step);
        await page.evaluate(
          (selectors) => {
            for (const element of document.querySelectorAll(selectors)) {
              const next = element.nextSibling;
              if (next?.nodeType === Node.TEXT_NODE && next.data.trim() === "|")
                next.remove();
              element.remove();
            }
          },
          drop.join(",") || ":not(*)",
        );
        await page.mouse.move(1, 1);
        await page.waitForTimeout(400);
        const clip = await page
          .locator(target ?? "[aria-label=Synthesizer]")
          .boundingBox();
        shots[app] = await page.screenshot({ clip });
        writeFileSync(`${out}/${name}-${app}-${colorScheme}.png`, shots[app]);
        await page.context().close();
      }
      const { count, diff, sizes } = await compare(
        browser,
        shots.react,
        shots.rust,
      );
      if (sizes) {
        failures++;
        console.log(`${name} ${colorScheme}: sizes differ`, sizes);
        continue;
      }
      writeFileSync(
        `${out}/${name}-diff-${colorScheme}.png`,
        Buffer.from(diff, "base64"),
      );
      if (count > allow) failures++;
      console.log(
        `${name} ${colorScheme}: ${count} pixels differ${count > allow ? `, over the ${allow} allowed` : ""}`,
      );
    }
  }
  await browser.close();
  process.exitCode = failures === 0 ? 0 : 1;
})();
