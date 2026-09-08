import { build, context, type BuildOptions } from 'esbuild';
import { cp, mkdir, readdir, rename, rm } from 'node:fs/promises';
import { extname, join, relative, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const source = join(root, 'miniprogram');
const output = join(root, 'dist/miniprogram');
const watch = process.argv.includes('--watch');
const entries = (await files(source)).filter((file) => file.endsWith('.ts') && (file.endsWith('/app.ts') || file.endsWith('/page.ts')));
const options: BuildOptions = {
  absWorkingDir: root,
  entryPoints: entries,
  outbase: source,
  outdir: output,
  bundle: true,
  format: 'cjs',
  platform: 'browser',
  target: 'es2022',
  sourcemap: 'external',
  sourcesContent: false,
  minify: true,
  legalComments: 'none',
  define: { 'import.meta.env': '{}' },
  logLevel: 'info',
};

await rm(join(root, 'dist'), { recursive: true, force: true });
await copyStatic();
await cp(join(root, 'project.config.json'), join(root, 'dist/project.config.json'));

if (watch) {
  const session = await context(options);
  await session.watch();
  console.log('miniapp build: watching');
} else {
  await build(options);
  await isolateSourceMaps();
  console.log(`miniapp build: ${entries.length} entries`);
}

async function isolateSourceMaps(): Promise<void> {
  for (const file of (await files(output)).filter((path) => path.endsWith('.map'))) {
    const target = join(root, 'dist/sourcemaps', relative(output, file));
    await mkdir(resolve(target, '..'), { recursive: true });
    await rename(file, target);
  }
}

async function copyStatic(): Promise<void> {
  for (const file of await files(source)) {
    if (!['.json', '.wxml', '.wxss', '.svg'].includes(extname(file))) continue;
    const target = join(output, relative(source, file));
    await mkdir(resolve(target, '..'), { recursive: true });
    await cp(file, target);
  }
}

async function files(directory: string): Promise<string[]> {
  const output: string[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) output.push(...(await files(path)));
    else if (entry.isFile()) output.push(path);
  }
  return output;
}
