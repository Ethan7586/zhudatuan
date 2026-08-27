import { writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

import { fileHash, files } from './artifacts.mjs';

const root = process.argv[2] ? resolve(process.argv[2]) : undefined;
if (!root || root === '/') throw new Error('INVENTORY_ROOT_INVALID');
const ignored = new Set(['checksums.sha256', 'release.sigstore.json']);
const lines = files(root)
  .filter((path) => !ignored.has(relative(root, path)))
  .map((path) => `${fileHash(path)}  ${relative(root, path).split('\\').join('/')}`);
writeFileSync(join(root, 'checksums.sha256'), `${lines.join('\n')}\n`, 'utf8');
console.log(`checksum inventory created: files=${lines.length}`);
