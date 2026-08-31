import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const here = path.dirname(fileURLToPath(import.meta.url));
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });

await page.goto(pathToFileURL(path.join(here, "morvia-visual-system.html")).href, { waitUntil: "load" });
await page.evaluate(async () => {
  await document.fonts.ready;
  await Promise.all(
    [...document.images].map((image) =>
      image.complete ? Promise.resolve() : new Promise((resolve) => image.addEventListener("load", resolve, { once: true })),
    ),
  );
});

await page.screenshot({ path: path.join(here, "morvia-visual-system-preview.png"), fullPage: true });
const height = await page.evaluate(() => document.documentElement.scrollHeight);
await page.pdf({
  path: path.join(here, "MORVIA-VISUAL-SYSTEM.pdf"),
  width: "1440px",
  height: `${height}px`,
  printBackground: true,
  margin: { top: "0", right: "0", bottom: "0", left: "0" },
});

await browser.close();
console.log(`Rendered 1440 × ${height} visual-system guide`);
