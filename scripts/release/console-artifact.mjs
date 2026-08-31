import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { directoryHash } from './artifacts.mjs';

export const CONSOLE_ARTIFACT_SCHEMA = 'shop.console-artifact.v1';

export function validateConsoleArtifactManifest(value, options = {}) {
  const expectedCommit = options.expectedCommit;
  const requireClean = options.requireClean === true;
  if (value?.schema !== CONSOLE_ARTIFACT_SCHEMA) throw new Error('CONSOLE_ARTIFACT_SCHEMA_INVALID');
  if (!/^[0-9a-f]{40}$/.test(value.commit ?? '')) throw new Error('CONSOLE_ARTIFACT_COMMIT_INVALID');
  if (expectedCommit !== undefined && value.commit !== expectedCommit) throw new Error('CONSOLE_ARTIFACT_COMMIT_MISMATCH');
  if (!['clean', 'dirty'].includes(value.sourceTree)) throw new Error('CONSOLE_ARTIFACT_SOURCE_TREE_INVALID');
  if (requireClean && value.sourceTree !== 'clean') throw new Error('CONSOLE_ARTIFACT_SOURCE_TREE_DIRTY');
  if (!isClientOrigin(value.apiBaseUrl)) throw new Error('CONSOLE_ARTIFACT_API_BASE_URL_INVALID');
  if (!isClientOrigin(value.authBaseUrl)) throw new Error('CONSOLE_ARTIFACT_AUTH_BASE_URL_INVALID');
  if (!/^[0-9]+\.[0-9]+\.[0-9]+(?:-[a-z0-9.]+)?$/i.test(value.clientVersion ?? '')) {
    throw new Error('CONSOLE_ARTIFACT_CLIENT_VERSION_INVALID');
  }
  return Object.freeze({
    schema: value.schema,
    commit: value.commit,
    sourceTree: value.sourceTree,
    apiBaseUrl: value.apiBaseUrl.replace(/\/$/, ''),
    authBaseUrl: value.authBaseUrl.replace(/\/$/, ''),
    clientVersion: value.clientVersion,
  });
}

export function readConsoleArtifact(directory, options = {}) {
  const root = resolve(directory);
  for (const name of ['index.html', 'console-build.json', '.vite/manifest.json']) {
    if (!existsSync(join(root, name))) throw new Error(`CONSOLE_ARTIFACT_FILE_MISSING:${name}`);
  }
  const manifest = validateConsoleArtifactManifest(JSON.parse(readFileSync(join(root, 'console-build.json'), 'utf8')), options);
  return Object.freeze({ root, manifest, sha256: directoryHash(root) });
}

function isClientOrigin(value) {
  return typeof value === 'string' && (/^https:\/\//.test(value) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(value));
}
