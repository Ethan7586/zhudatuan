import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

export function hash(value) {
  return createHash('sha256').update(value).digest('hex');
}

export function fileHash(path) {
  return hash(readFileSync(path));
}

export function directoryHash(directory) {
  const digest = createHash('sha256');
  for (const path of files(directory)) {
    digest.update(relative(directory, path).split('\\').join('/'));
    digest.update('\0');
    digest.update(readFileSync(path));
    digest.update('\0');
  }
  return digest.digest('hex');
}

export function files(directory, result = []) {
  for (const entry of readdirSync(directory, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name))) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files(path, result);
    else if (entry.isFile()) result.push(path);
    else throw new Error(`RELEASE_SPECIAL_FILE_FORBIDDEN:${relative(directory, path)}`);
  }
  return result;
}

