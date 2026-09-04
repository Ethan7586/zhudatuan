import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const sharp = require("sharp");
const here = path.dirname(fileURLToPath(import.meta.url));
const svgDir = path.join(here, "assets", "svg");
const outputDir = path.join(here, "assets", "app-icons");
const markPath = path.join(svgDir, "morvia-mark.svg");
const lockupPath = path.join(svgDir, "morvia-master-lockup.svg");

fs.mkdirSync(outputDir, { recursive: true });
fs.copyFileSync(markPath, path.join(outputDir, "favicon.svg"));

async function renderIcon(name, size, occupiedRatio = 0.78) {
  const innerSize = Math.round(size * occupiedRatio);
  const leading = Math.floor((size - innerSize) / 2);
  const trailing = size - innerSize - leading;
  await sharp(markPath)
    .resize(innerSize, innerSize)
    .extend({
      top: leading,
      bottom: trailing,
      left: leading,
      right: trailing,
      background: "#FFFFFF",
    })
    .flatten({ background: "#FFFFFF" })
    .png()
    .toFile(path.join(outputDir, name));
}

await Promise.all([
  renderIcon("favicon-32.png", 32, 0.82),
  renderIcon("apple-touch-icon.png", 180),
  renderIcon("icon-192.png", 192),
  renderIcon("icon-512.png", 512),
  renderIcon("icon-1024.png", 1024),
  renderIcon("icon-maskable-512.png", 512, 0.64),
]);

const socialLockup = await sharp(lockupPath).resize({ width: 780 }).png().toBuffer();
await sharp({
  create: {
    width: 1200,
    height: 630,
    channels: 4,
    background: "#F4F5F8",
  },
})
  .composite([{ input: socialLockup, gravity: "center" }])
  .png()
  .toFile(path.join(outputDir, "opengraph-image.png"));

console.log(`Generated product assets in ${outputDir}`);
