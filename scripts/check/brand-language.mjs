import { readdir, readFile } from 'node:fs/promises';
import { extname, join, relative, resolve } from 'node:path';
import { createHash } from 'node:crypto';

const workspace = process.cwd();
const scanRoots = [
  'apps/auth-web/index.html',
  'apps/auth-web/public',
  'apps/auth-web/src',
  'apps/console/index.html',
  'apps/console/public',
  'apps/console/src',
  'apps/storefront-web/app',
  'apps/storefront-web/src',
  'packages/design/src',
  'services/commerce/src',
  'services/commerce-api/src',
  'extensions/payment',
];
const textExtensions = new Set(['.css', '.html', '.json', '.mjs', '.svg', '.ts', '.tsx', '.webmanifest']);
const allowedAliasSource = 'apps/storefront-web/src/domain/brand/productBrand.ts';
const retiredBrandImageHashes = new Set(['e5e0c9d09a76287a3f4af72df3d3c050b7a56638d827787553fb5e572ed69445']);
const forbidden = [
  { label: 'retired Chinese brand', pattern: /智慧翼/u },
  { label: 'retired Chinese name', pattern: /[築筑]大团/u },
  { label: 'retired English brand', pattern: /(?:Smart|SMART)(?:\s+|-\s*)(?:Wing|WING)/u },
  { label: 'non-canonical Latin display name', pattern: /(?:ZhudaTuan|Zhudatuan)/u },
];

async function collect(path) {
  const absolute = resolve(workspace, path);
  if (extname(absolute)) return [absolute];
  const entries = await readdir(absolute, { withFileTypes: true });
  const nested = await Promise.all(
    entries
      .filter((entry) => entry.name !== 'design-references' && entry.name !== 'dist')
      .map((entry) => collect(join(path, entry.name))),
  );
  return nested.flat();
}

const productionFiles = (await Promise.all(scanRoots.map(collect))).flat();
const files = productionFiles
  .filter((file) => textExtensions.has(extname(file)))
  .filter((file) => !/\.(?:test|stories)\.[^.]+$/u.test(file));
const violations = [];

for (const file of productionFiles.filter((candidate) => extname(candidate) === '.png')) {
  const digest = createHash('sha256').update(await readFile(file)).digest('hex');
  if (retiredBrandImageHashes.has(digest)) {
    violations.push(`${relative(workspace, file)} retired brand image`);
  }
}

for (const file of files) {
  const displayPath = relative(workspace, file);
  if (displayPath === allowedAliasSource) continue;
  const lines = (await readFile(file, 'utf8')).split(/\r?\n/u);
  lines.forEach((line, index) => {
    for (const rule of forbidden) {
      if (rule.pattern.test(line)) violations.push(`${displayPath}:${index + 1} ${rule.label}`);
    }
  });
}

if (violations.length > 0) {
  console.error(`Brand language check failed (${violations.length}):`);
  violations.forEach((violation) => console.error(`- ${violation}`));
  process.exitCode = 1;
} else {
  console.log(`Brand language check passed (${files.length} production text files).`);
}
