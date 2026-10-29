// What the parity scripts share: the two apps' addresses, a page on each
// (with a stand-in MIDI controller when asked for), and the steps they take.
const { createRequire } = require("node:module");
const path = require("node:path");

// Playwright as installed globally, or else as web-react installs it.
function playwright() {
  try {
    return require("playwright");
  } catch {
    return createRequire(
      path.join(__dirname, "../../../web-react/package.json"),
    )("playwright");
  }
}

// The React dev server's and `trunk serve`'s own ports, unless set.
const APPS = {
  react: process.env.REACT_URL ?? "http://localhost:3000/",
  rust: process.env.RUST_URL ?? "http://localhost:8080/",
};

const launch = () => playwright().chromium.launch();

// `--fake-midi` plays a stand-in controller called Fake Keys;
// `--fake-midi=<name>` names it (`--fake-midi=OP-1` for the OP-1's map).
function fakeMidi(args) {
  const flag = args.find(
    (arg) => arg === "--fake-midi" || arg.startsWith("--fake-midi="),
  );
  if (!flag) return undefined;
  return flag.includes("=") ? flag.slice(flag.indexOf("=") + 1) : "Fake Keys";
}

// A page on `url`, loaded and settled. With `midi`, a controller of that
// name answers navigator.requestMIDIAccess, and window.__send plays bytes
// on it.
async function open(browser, url, { viewport, colorScheme, midi } = {}) {
  const context = await browser.newContext({
    viewport: viewport ?? { width: 1400, height: 900 },
    deviceScaleFactor: 1,
    colorScheme,
  });
  if (midi)
    await context.addInitScript((name) => {
      const input = {
        id: "in-1",
        name,
        manufacturer: "Test",
        state: "connected",
        onmidimessage: null,
        close: () => Promise.resolve(),
      };
      const access = {
        inputs: new Map([["in-1", input]]),
        outputs: new Map(),
        onstatechange: null,
      };
      navigator.requestMIDIAccess = () => Promise.resolve(access);
      window.__send = (bytes) =>
        input.onmidimessage?.({ data: new Uint8Array(bytes) });
    }, midi);
  const page = await context.newPage();
  page.on("pageerror", (error) =>
    console.log(`${url} pageerror:`, error.message),
  );
  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  return page;
}

const DEVICE = "[aria-label=Synthesizer]";
const knob = (page, n) =>
  page.locator(`${DEVICE} button.cursor-ew-resize`).nth(n);
const tile = (page, n) => page.locator(`${DEVICE} [role=group] button`).nth(n);

// One step, then a wait (150 ms unless `wait` says):
// - `press`, `down`, `up`: a key pressed, held or let go; `type`: text typed
// - `click`: a control on the Device by its label; `clickStarts`: by its
//   label's start; `pageClick`: anywhere on the page by a label's start;
//   `panelClick`: in the MIDI panel, by label or text
// - `pad`: a pad clicked, by its place among the pads
// - `knob`: a knob clicked `turns` times (once unless set); `wheel`: a
//   knob wheeled by `deltaY` (-100 unless set)
// - `tile`, `dbltile`: a screen tile clicked or double-clicked
// - `cell`: a drum-grid cell pressed, as [row, step]
// - `midi`: bytes from the stand-in controller
// - `storage`: localStorage replaced with these keys; `reload`: the page
//   loaded again
async function act(page, step) {
  if (step.press) await page.keyboard.press(step.press);
  if (step.down) await page.keyboard.down(step.down);
  if (step.up) await page.keyboard.up(step.up);
  if (step.type) await page.keyboard.type(step.type);
  if (step.click)
    await page
      .locator(`${DEVICE} [aria-label="${step.click}"]`)
      .first()
      .click();
  if (step.clickStarts)
    await page
      .locator(`${DEVICE} [aria-label^="${step.clickStarts}"]`)
      .first()
      .click();
  if (step.pageClick)
    await page.locator(`[aria-label^="${step.pageClick}"]`).first().click();
  if (step.panelClick) {
    const aside = page.locator("aside[aria-label=MIDI]");
    await aside
      .locator(`[aria-label="${step.panelClick}"]`)
      .or(aside.getByText(step.panelClick, { exact: true }))
      .first()
      .click();
  }
  if (step.pad !== undefined) {
    const box = await page
      .locator("[aria-label=Pads] button")
      .nth(step.pad)
      .boundingBox();
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  }
  if (step.knob !== undefined)
    for (let i = 0; i < (step.turns ?? 1); i++)
      await knob(page, step.knob).click();
  if (step.wheel !== undefined) {
    const box = await knob(page, step.wheel).boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.wheel(0, step.deltaY ?? -100);
  }
  if (step.tile !== undefined) await tile(page, step.tile).click();
  if (step.dbltile !== undefined) await tile(page, step.dbltile).dblclick();
  if (step.cell)
    await page
      .locator(
        `[aria-label="Drum grid"] > div:nth-child(${step.cell[0] + 1}) > span:nth-child(${step.cell[1] + 2})`,
      )
      .dispatchEvent("pointerdown", {
        button: 0,
        bubbles: true,
        cancelable: true,
      });
  if (step.midi)
    await page.evaluate((bytes) => window.__send(bytes), step.midi);
  if (step.storage)
    await page.evaluate((storage) => {
      localStorage.clear();
      for (const [key, value] of Object.entries(storage))
        localStorage.setItem(key, value);
    }, step.storage);
  if (step.reload) await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(step.wait ?? 150);
}

module.exports = { APPS, act, fakeMidi, launch, open };
