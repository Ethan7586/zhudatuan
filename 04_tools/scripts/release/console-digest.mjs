import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';

import { files } from './artifacts.mjs';

const EVIDENCE_FILE = 'console-build.json';

export function consoleImmutableArtifactDigest(directory) {
  const root = resolve(directory);
  const digest = createHash('sha256');
  for (const path of files(root)) {
    const name = relative(root, path).split('\\').join('/');
    if (name === EVIDENCE_FILE) continue;
    digest.update(name);
    digest.update('\0');
    digest.update(readFileSync(path));
    digest.update('\0');
  }
  return `sha256:${digest.digest('hex')}`;
}
