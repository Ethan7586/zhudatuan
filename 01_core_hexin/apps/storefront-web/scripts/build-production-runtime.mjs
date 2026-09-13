#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { build } from 'esbuild';

const appRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const distRoot = join(appRoot, 'dist');
const runtimeEntry = join(distRoot, 'start.mjs');
const runtimeManifest = join(distRoot, 'production-runtime.json');
const source = `
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startProdServer } from 'vinext/server/prod-server';

const port = Number.parseInt(process.env.STOREFRONT_PORT ?? process.env.PORT ?? '3000', 10);
const host = process.env.STOREFRONT_HOST ?? process.env.HOST ?? '127.0.0.1';

await startProdServer({
  port,
  host,
  outDir: dirname(fileURLToPath(import.meta.url)),
});
`;

const result = await build({
  absWorkingDir: appRoot,
  stdin: {
    contents: source,
    loader: 'js',
    resolveDir: appRoot,
    sourcefile: 'storefront-production-entry.mjs',
  },
  outfile: runtimeEntry,
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  packages: 'bundle',
  sourcemap: false,
  legalComments: 'none',
  metafile: true,
  logLevel: 'warning',
});

const externalImports = [
  ...new Set(
    Object.values(result.metafile.outputs)
      .flatMap((output) => output.imports)
      .filter((entry) => entry.external)
      .map((entry) => entry.path)
  ),
].sort();
const unexpectedExternals = externalImports.filter((path) => !path.startsWith('node:'));
if (unexpectedExternals.length > 0) {
  throw new Error(`STOREFRONT_RUNTIME_EXTERNAL_DEPENDENCY:${unexpectedExternals.join(',')}`);
}

const bundledPackages = [...new Set(Object.keys(result.metafile.inputs).map(packageNameFromInput).filter(Boolean))].sort();
const runtimeBytes = (await stat(runtimeEntry)).size;
const runtimeSha256 = createHash('sha256')
  .update(await readFile(runtimeEntry))
  .digest('hex');
const vinextEntry = fileURLToPath(import.meta.resolve('vinext'));
const vinextPackage = JSON.parse(await readFile(resolve(dirname(vinextEntry), '..', 'package.json'), 'utf8'));
const manifest = {
  schema: 'storefront.production-runtime.v1',
  entry: 'start.mjs',
  vinextVersion: vinextPackage.version,
  bundledPackages,
  externalImports,
  bytes: runtimeBytes,
  sha256: `sha256:${runtimeSha256}`,
};
await writeFile(runtimeManifest, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
process.stdout.write(`Storefront production runtime: ${runtimeBytes} bytes; bundled packages: ${bundledPackages.join(', ')}\n`);

function packageNameFromInput(path) {
  const normalized = path.replaceAll('\\', '/');
  const marker = '/node_modules/';
  const offset = normalized.lastIndexOf(marker);
  if (offset < 0) return null;
  const segments = normalized.slice(offset + marker.length).split('/');
  return segments[0]?.startsWith('@') ? `${segments[0]}/${segments[1]}` : segments[0];
}
