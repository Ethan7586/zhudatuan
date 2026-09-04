import { readFileSync, realpathSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const moduleDirectory = dirname(fileURLToPath(import.meta.url));
const candidate = realpathSync(resolve(moduleDirectory, '../../..'));
const manifest = JSON.parse(readFileSync(join(candidate, 'package.json'), 'utf8'));

if (manifest.name !== 'zhudatuan-main' || manifest.private !== true) {
  throw new Error(`ZHUDATUAN_REPOSITORY_ROOT_INVALID:${candidate}`);
}

export const repositoryRoot = candidate;
