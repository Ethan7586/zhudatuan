import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const targets = process.argv.slice(2);
if (targets.length === 0) {
  console.error('Usage: node 04_tools/scripts/check/browser-brand-language.mjs <url> [url ...]');
  process.exit(2);
}

const forbidden = /智慧翼|[築筑]大团|(?:Smart|SMART)(?:\s+|-\s*)(?:Wing|WING)|ZhudaTuan|Zhudatuan/u;
const screenshotDirectory = process.env.BRAND_SCREENSHOT_DIR;
const allowBrowserErrors = process.env.BRAND_ALLOW_BROWSER_ERRORS === '1';
if (screenshotDirectory) await mkdir(screenshotDirectory, { recursive: true });

const browser = await chromium.launch({ headless: true });
const failures = [];

try {
  for (const target of targets) {
    const url = new URL(target);
    const viewports = url.port === '4303' || url.hostname === 'zhudatuan.com'
      ? [{ name: 'desktop', width: 1440, height: 900 }, { name: 'mobile', width: 390, height: 844 }]
      : [{ name: 'desktop', width: 1440, height: 900 }];

    for (const viewport of viewports) {
      const context = await browser.newContext({ viewport });
      const page = await context.newPage();
      const browserErrors = [];
      page.on('pageerror', (error) => browserErrors.push(error.message));
      page.on('console', (message) => {
        if (message.type() === 'error') browserErrors.push(message.text());
      });

      const response = await page.goto(url.toString(), { waitUntil: 'domcontentloaded', timeout: 30_000 });
      await page.waitForTimeout(1_000);
      const evidence = await page.evaluate(() => {
        const attributes = Array.from(document.querySelectorAll('[aria-label], [alt], [title]'))
          .flatMap((element) => ['aria-label', 'alt', 'title'].map((name) => element.getAttribute(name) ?? ''));
        const metadata = Array.from(document.querySelectorAll('meta[content]'))
          .map((element) => element.getAttribute('content') ?? '');
        const svgTitles = Array.from(document.querySelectorAll('svg title, svg desc')).map((element) => element.textContent ?? '');
        return {
          title: document.title,
          content: [document.body.innerText, ...attributes, ...metadata, ...svgTitles].join('\n'),
          bodyLength: document.body.innerText.trim().length,
          overlay: Boolean(document.querySelector('[data-nextjs-dialog], .vite-error-overlay, #webpack-dev-server-client-overlay')),
          manifest: document.querySelector('link[rel="manifest"]')?.getAttribute('href') ?? null,
        };
      });

      let manifest = '';
      if (evidence.manifest) {
        const manifestUrl = new URL(evidence.manifest, url);
        if (url.hostname === '127.0.0.1' || url.hostname === 'localhost') {
          manifestUrl.protocol = url.protocol;
          manifestUrl.host = url.host;
        }
        const manifestResponse = await context.request.get(manifestUrl.toString());
        if (manifestResponse.ok()) manifest = await manifestResponse.text();
      }
      const searchable = `${evidence.title}\n${evidence.content}\n${manifest}`;
      const retiredBrandMatch = searchable.match(forbidden)?.[0] ?? null;
      const retiredBrandLines = searchable.split('\n').filter((line) => forbidden.test(line)).slice(0, 3);
      const label = `${url.hostname}-${url.port || 'https'}-${viewport.name}`;
      if (!response || response.status() >= 400) failures.push(`${label}: HTTP ${response?.status() ?? 'no response'}`);
      if (evidence.bodyLength === 0) failures.push(`${label}: blank page`);
      if (evidence.overlay) failures.push(`${label}: framework error overlay`);
      if (retiredBrandMatch) failures.push(`${label}: retired brand copy rendered: ${retiredBrandLines.map((line) => JSON.stringify(line)).join(' | ')}`);
      if (browserErrors.length > 0 && !allowBrowserErrors) failures.push(`${label}: browser errors: ${browserErrors.slice(0, 3).join(' | ')}`);
      if (screenshotDirectory) await page.screenshot({ path: `${screenshotDirectory}/${label}.png`, fullPage: false });
      console.log(`${label}: HTTP ${response?.status() ?? 'none'}, title="${evidence.title}", body=${evidence.bodyLength}, retired-brand=${retiredBrandMatch ? JSON.stringify(retiredBrandMatch) : '0'}, browser-errors=${browserErrors.length}`);
      await context.close();
    }
  }
} finally {
  await browser.close();
}

if (failures.length > 0) {
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exitCode = 1;
}
