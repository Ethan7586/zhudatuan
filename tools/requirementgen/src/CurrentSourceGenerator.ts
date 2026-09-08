import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { importCurrentFunctionSource } from './CurrentSource';

const root = resolve(import.meta.dirname, '../../..');
const generated = await importCurrentFunctionSource(root);
const target = resolve(root, generated.path);
if (process.argv.includes('--check')) {
  const current = await readFile(target, 'utf8').catch(() => '');
  if (current !== generated.content) throw new Error('CURRENT_FUNCTION_SOURCE_DRIFT');
} else {
  await writeFile(target, generated.content, 'utf8');
}
