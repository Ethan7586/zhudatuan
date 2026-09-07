import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import {
  SFL_CONSOLE_ARTIFACT_SCHEMA_VERSION,
  parseSflConsoleArtifact,
} from '@shop/config/sfl-console-runtime';
import { directoryHash } from './artifacts.mjs';
import { consoleImmutableArtifactDigest } from './console-digest.mjs';

export const CONSOLE_ARTIFACT_SCHEMA = SFL_CONSOLE_ARTIFACT_SCHEMA_VERSION;

export async function validateConsoleArtifactManifest(value, options = {}) {
  const manifest = await parseSflConsoleArtifact(value);
  if (options.expectedCommit !== undefined && manifest.source_sha !== options.expectedCommit) {
    throw new Error('CONSOLE_ARTIFACT_COMMIT_MISMATCH');
  }
  if (options.requireClean === true && manifest.source_tree !== 'clean') {
    throw new Error('CONSOLE_ARTIFACT_SOURCE_TREE_DIRTY');
  }
  return manifest;
}

export async function readConsoleArtifact(directory, options = {}) {
  const root = resolve(directory);
  for (const name of ['index.html', 'console-build.json', '.vite/manifest.json']) {
    if (!existsSync(join(root, name))) throw new Error(`CONSOLE_ARTIFACT_FILE_MISSING:${name}`);
  }
  const manifest = await validateConsoleArtifactManifest(
    JSON.parse(readFileSync(join(root, 'console-build.json'), 'utf8')),
    options,
  );
  const immutableArtifactDigest = consoleImmutableArtifactDigest(root);
  if (manifest.immutable_artifact_digest !== immutableArtifactDigest) {
    throw new Error('CONSOLE_IMMUTABLE_ARTIFACT_DIGEST_MISMATCH');
  }
  return Object.freeze({
    root,
    manifest,
    immutableArtifactDigest,
    sha256: directoryHash(root),
  });
}
