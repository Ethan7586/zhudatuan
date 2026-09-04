import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const svgDir = path.join(here, "assets", "svg");

const sourceMarkPath = path.join(here, "components", "morvia-mark-master.svg");
const sourceApprovedWordmarkPath = path.join(
  here,
  "components",
  "zhudatuan-wordmark-outlined.svg",
);
const sourceMorviaWordmarkPath = path.join(
  here,
  "components",
  "morvia-wordmark-outlined.svg",
);

fs.mkdirSync(svgDir, { recursive: true });

function parseComponent(filePath, prefix) {
  const source = fs.readFileSync(filePath, "utf8");
  const viewBox = source.match(/viewBox="([^"]+)"/)?.[1];
  if (!viewBox) throw new Error(`Missing viewBox: ${filePath}`);

  let body = source
    .replace(/^<\?xml[^>]*>\s*/u, "")
    .replace(/^<svg[^>]*>\s*/u, "")
    .replace(/\s*<\/svg>\s*$/u, "")
    .replace(/\s*<title[^>]*>[\s\S]*?<\/title>/gu, "")
    .replace(/\s*<desc[^>]*>[\s\S]*?<\/desc>/gu, "");

  body = body
    .replace(/id="([^"]+)"/gu, (_, id) => `id="${prefix}-${id}"`)
    .replace(
      /(href|xlink:href)="#([^"]+)"/gu,
      (_, attribute, id) => `${attribute}="#${prefix}-${id}"`,
    );

  return { viewBox, body };
}

function recolor(component, color, includeMarkPalette = false) {
  let body = component.body
    .replace(/#111111/giu, color)
    .replace(/rgb\(6\.666667%,\s*6\.666667%,\s*6\.666667%\)/giu, color);

  if (includeMarkPalette) {
    body = body.replace(/#143A8F|#0D2D72|#2857BD|#0F347F/giu, color);
  }

  return { ...component, body };
}

function place(component, x, y, width, height) {
  return [
    `<svg x="${x}" y="${y}" width="${width}" height="${height}"`,
    ` viewBox="${component.viewBox}" preserveAspectRatio="xMinYMid meet">`,
    component.body,
    "</svg>",
  ].join("");
}

function documentSvg({ width, height, title, description, content }) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title desc">
  <title id="title">${title}</title>
  <desc id="desc">${description}</desc>
  ${content}
</svg>
`;
}

function save(name, svg) {
  fs.writeFileSync(path.join(svgDir, name), svg, "utf8");
}

const mark = parseComponent(sourceMarkPath, "mark");
const approved = parseComponent(sourceApprovedWordmarkPath, "approved");
const morvia = parseComponent(sourceMorviaWordmarkPath, "morvia");

const markWhite = recolor(mark, "#FFFFFF", true);
const markMono = recolor(mark, "#111111", true);
const approvedWhite = recolor(approved, "#FFFFFF");
const morviaWhite = recolor(morvia, "#FFFFFF");

save(
  "morvia-mark.svg",
  documentSvg({
    width: 512,
    height: 512,
    title: "MORVIA M mark",
    description: "The approved blue M mark, reproduced without geometric changes.",
    content: place(mark, 0, 0, 512, 512),
  }),
);

save(
  "morvia-mark-mono.svg",
  documentSvg({
    width: 512,
    height: 512,
    title: "MORVIA M mark monochrome",
    description: "One-color reproduction of the approved M mark.",
    content: place(markMono, 0, 0, 512, 512),
  }),
);

save(
  "morvia-mark-white.svg",
  documentSvg({
    width: 512,
    height: 512,
    title: "MORVIA M mark reverse",
    description: "White technical reproduction of the approved M mark.",
    content: place(markWhite, 0, 0, 512, 512),
  }),
);

save(
  "morvia-wordmark.svg",
  documentSvg({
    width: 550,
    height: 116,
    title: "MORVIA wordmark",
    description: "Uppercase MORVIA wordmark set in the approved heavy sans-serif skeleton.",
    content: place(morvia, 0, 0, 550, 116),
  }),
);

const masterContent = [
  place(mark, 0, 0, 160, 160),
  place(morvia, 174, 13, 330, 70),
  place(approved, 174, 96, 440, 50),
].join("\n  ");

save(
  "morvia-master-lockup.svg",
  documentSvg({
    width: 640,
    height: 160,
    title: "MORVIA zhudatuan 主打团 master lockup",
    description: "Primary bilingual signature with MORVIA above the approved zhudatuan 主打团 wordmark.",
    content: masterContent,
  }),
);

save(
  "morvia-compact-lockup.svg",
  documentSvg({
    width: 460,
    height: 120,
    title: "MORVIA compact lockup",
    description: "Compact navigation signature pairing the approved M mark with MORVIA.",
    content: [place(mark, 0, 0, 120, 120), place(morvia, 138, 27, 300, 64)].join("\n  "),
  }),
);

save(
  "morvia-established-lockup.svg",
  documentSvg({
    width: 840,
    height: 112,
    title: "MORVIA extended established-name lockup",
    description: "Extended one-line signature showing MORVIA with the approved zhudatuan 主打团 name.",
    content: [
      place(mark, 0, 0, 112, 112),
      place(morvia, 130, 30, 245, 52),
      '<rect x="401" y="29" width="2" height="54" fill="#D7DBE5"/>',
      place(approved, 430, 34, 400, 46),
    ].join("\n  "),
  }),
);

save(
  "morvia-stacked-lockup.svg",
  documentSvg({
    width: 560,
    height: 330,
    title: "MORVIA stacked lockup",
    description: "Centered vertical signature for square and formal layouts.",
    content: [
      place(mark, 170, 0, 220, 220),
      place(morvia, 120, 190, 320, 68),
      place(approved, 100, 277, 360, 41),
    ].join("\n  "),
  }),
);

save(
  "morvia-master-lockup-mono.svg",
  documentSvg({
    width: 640,
    height: 160,
    title: "MORVIA master lockup monochrome",
    description: "One-color fallback for restricted production.",
    content: [
      place(markMono, 0, 0, 160, 160),
      place(morvia, 174, 13, 330, 70),
      place(approved, 174, 96, 440, 50),
    ].join("\n  "),
  }),
);

save(
  "morvia-master-lockup-white.svg",
  documentSvg({
    width: 640,
    height: 160,
    title: "MORVIA master lockup reverse",
    description: "White fallback for dark backgrounds.",
    content: [
      place(markWhite, 0, 0, 160, 160),
      place(morviaWhite, 174, 13, 330, 70),
      place(approvedWhite, 174, 96, 440, 50),
    ].join("\n  "),
  }),
);

save(
  "morvia-avatar-light.svg",
  documentSvg({
    width: 512,
    height: 512,
    title: "MORVIA avatar light",
    description: "Approved blue M mark on a white square field.",
    content: '<rect width="512" height="512" rx="112" fill="#FFFFFF"/>\n  ' + place(mark, 46, 46, 420, 420),
  }),
);

save(
  "morvia-avatar-blue.svg",
  documentSvg({
    width: 512,
    height: 512,
    title: "MORVIA avatar blue",
    description: "White technical M mark on MORVIA blue.",
    content: '<rect width="512" height="512" rx="112" fill="#143A8F"/>\n  ' + place(markWhite, 46, 46, 420, 420),
  }),
);
