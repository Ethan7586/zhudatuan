// Declaration projection:
//   node --import tsx 04_tools/scripts/release/generate-node-manifests.mjs [--check]
// Runtime release evidence:
//   node --import tsx 04_tools/scripts/release/generate-node-manifests.mjs \
//     --release-output <dir> --source-sha <git-sha> --artifact-digest <sha256:...> \
//     --build-id <id> --generated-at <ISO-8601>

import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  materializeNodeManifestRegistryDeclaration,
  materializeNodeManifestRegistryRelease,
} from '../../../01_core_hexin/packages/config/src/SflNodeKernel.ts';
import {
  SFL_NODE_MANIFEST_REGISTRY_DECLARATION,
  SFL_NODE_REGISTRY,
} from '../../../01_core_hexin/packages/config/src/SflNodeRegistry.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const options = parseArguments(process.argv.slice(2));
const outputDirectory = options.releaseOutput ?? resolve(root, '02_platform_pingtai/config/node-manifests');
const checking = options.checking;
const registry = options.releaseEvidence === null
  ? await materializeNodeManifestRegistryDeclaration(SFL_NODE_MANIFEST_REGISTRY_DECLARATION)
  : await materializeNodeManifestRegistryRelease(SFL_NODE_MANIFEST_REGISTRY_DECLARATION, options.releaseEvidence);
const fileByNode = new Map(SFL_NODE_REGISTRY.node_bindings
  .map((binding) => [binding.node_id, binding.runtime_manifest_file]));
const expectedFiles = new Set(fileByNode.values());

if (fileByNode.size !== registry.manifests.length) throw new Error('NODE_MANIFEST_FILE_BINDING_MISMATCH');

for (const manifest of registry.manifests) {
  const file = fileByNode.get(manifest.node_id);
  if (file === undefined) throw new Error(`NODE_MANIFEST_FILE_BINDING_MISSING:${manifest.node_id}`);
  const serialized = `${JSON.stringify(manifest, null, 2)}\n`;
  const destination = resolve(outputDirectory, file);
  if (checking) {
    const existing = await readFile(destination, 'utf8').catch(() => '');
    if (existing !== serialized) throw new Error(`NODE_MANIFEST_GENERATED_DRIFT:${file}`);
  } else {
    await mkdir(outputDirectory, { recursive: true });
    await writeFile(destination, serialized);
  }
}

const unexpected = (await readdir(outputDirectory).catch(() => []))
  .filter((file) => file.endsWith('.json') && !expectedFiles.has(file));
if (unexpected.length > 0) throw new Error(`NODE_MANIFEST_UNDECLARED_FILES:${unexpected.sort().join(',')}`);

console.log(`SFL NodeManifest ${options.releaseEvidence === null ? 'declaration projection' : 'release evidence'} verified: ${registry.manifests.length} nodes, registry ${registry.registry_version}.`);

function parseArguments(values) {
  if (values.length === 0) return Object.freeze({ checking: false, releaseOutput: null, releaseEvidence: null });
  if (values.length === 1 && values[0] === '--check') {
    return Object.freeze({ checking: true, releaseOutput: null, releaseEvidence: null });
  }
  const parsed = new Map();
  for (let index = 0; index < values.length; index += 2) {
    const key = values[index];
    const value = values[index + 1];
    if (typeof key !== 'string' || typeof value !== 'string' || !key.startsWith('--') || parsed.has(key)) {
      throw new Error('NODE_MANIFEST_ARGUMENT_INVALID');
    }
    parsed.set(key, value);
  }
  const expected = ['--artifact-digest', '--build-id', '--generated-at', '--release-output', '--source-sha'];
  if (parsed.size !== expected.length || expected.some((key) => !parsed.has(key))) {
    throw new Error('NODE_MANIFEST_RELEASE_ARGUMENTS_REQUIRED');
  }
  const releaseOutput = resolve(parsed.get('--release-output'));
  if (releaseOutput === '/' || releaseOutput === root || releaseOutput === resolve(root, '02_platform_pingtai/config/node-manifests')) {
    throw new Error('NODE_MANIFEST_RELEASE_OUTPUT_INVALID');
  }
  return Object.freeze({
    checking: false,
    releaseOutput,
    releaseEvidence: Object.freeze({
      source_sha: parsed.get('--source-sha'),
      build_id: parsed.get('--build-id'),
      immutable_artifact_digest: parsed.get('--artifact-digest'),
      generated_at: parsed.get('--generated-at'),
    }),
  });
}
