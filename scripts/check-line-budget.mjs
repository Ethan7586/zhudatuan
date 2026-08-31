import { readdirSync, readFileSync } from 'node:fs';
import { extname, join, relative } from 'node:path';
import { repositoryRoot } from './lib/RepositoryRoot.mjs';

const root = repositoryRoot;
const limit = 299;
const roots = ['apps', 'services', 'packages', 'extensions'];
const sourceExtensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.css', '.wxml', '.wxss']);
const ignoredDirectories = new Set(['.next', '.open-next', 'build', 'coverage', 'dist', 'node_modules', 'out', 'storybook-static', 'test', 'tests', '__tests__']);
const vendoredStaticPrefixes = Object.freeze(['apps/console/public/design-references/', 'apps/console/public/demo/']);

function ignoredFile(name) {
  return name.includes('.test.') || name.includes('.spec.') || name.includes('.generated.') || name === 'operations.js';
}

function generatedFile(source) {
  const firstLine = source.split(/\r?\n/, 1)[0] ?? '';
  return /^\/\/ Generated (?:by|from) .+\. Do not edit\.$/.test(firstLine);
}

function collect(directory, output = []) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const target = join(directory, entry.name);
    if (entry.isDirectory()) {
      if (!ignoredDirectories.has(entry.name)) collect(target, output);
      continue;
    }
    if (entry.isFile() && sourceExtensions.has(extname(entry.name)) && !ignoredFile(entry.name)) output.push(target);
  }
  return output;
}

const failures = roots
  .flatMap((name) => collect(join(root, name)))
  .map((file) => {
    const source = readFileSync(file, 'utf8');
    return {
      file: relative(root, file).split('\\').join('/'),
      generated: generatedFile(source),
      lines: source.split(/\r?\n/).length,
    };
  })
  .filter(({ file }) => !vendoredStaticPrefixes.some((prefix) => file.startsWith(prefix)))
  .filter(({ generated }) => !generated)
  .filter(({ lines }) => lines > limit)
  .sort((left, right) => right.lines - left.lines);

if (failures.length > 0) {
  console.error(`product source line budget failed: limit=${limit} count=${failures.length}`);
  for (const item of failures) console.error(`${item.lines}\t${item.file}`);
  process.exit(1);
}

console.log(`product source line budget passed: limit=${limit}`);
