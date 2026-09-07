import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const registryPath = resolve(root, '02_platform_pingtai/config/node-registry.json');
const outputDirectory = resolve(root, '02_platform_pingtai/config/node-manifests');
const registry = JSON.parse(await readFile(registryPath, 'utf8'));
const checking = process.argv.includes('--check');

if (registry.schema_version !== 'sfl.node-registry/v1' || !Array.isArray(registry.nodes)) {
  throw new Error('NODE_REGISTRY_INVALID');
}

const ids = new Set(registry.nodes.map(({ node_id: id }) => id));
const files = new Set();
for (const node of registry.nodes) {
  if (!node.file || files.has(node.file)) throw new Error(`NODE_REGISTRY_FILE_INVALID:${node.file ?? ''}`);
  files.add(node.file);
  if (node.parent_node_id !== null && !ids.has(node.parent_node_id)) throw new Error(`NODE_REGISTRY_PARENT_MISSING:${node.node_id}`);
  const level = Number(String(node.signed_level).slice(1));
  if (!Number.isInteger(level) || level < 0 || level > 11) throw new Error(`NODE_REGISTRY_LEVEL_INVALID:${node.node_id}`);
  if ((level <= 5) !== (node.node_profile === 'operating_mall')) throw new Error(`NODE_REGISTRY_PROFILE_INVALID:${node.node_id}`);
  if (node.node_profile === 'consumer' && node.surfaces?.includes('console')) throw new Error(`NODE_REGISTRY_CONSUMER_CONSOLE_FORBIDDEN:${node.node_id}`);

  const { file: _file, ...definition } = node;
  const payload = {
    schema_version: 'sfl.node-manifest/v1',
    manifest_id: definition.manifest_id,
    manifest_version: registry.manifest_version,
    generated_at: registry.generated_at,
    line_id: registry.line_id,
    ...definition,
  };
  const manifest = { ...payload, manifest_digest: digest(payload) };
  const serialized = `${JSON.stringify(manifest, null, 2)}\n`;
  const destination = resolve(outputDirectory, node.file);
  if (checking) {
    const existing = await readFile(destination, 'utf8').catch(() => '');
    if (existing !== serialized) throw new Error(`NODE_MANIFEST_GENERATED_DRIFT:${node.file}`);
  } else {
    await mkdir(outputDirectory, { recursive: true });
    await writeFile(destination, serialized);
  }
}

function digest(value) {
  return `sha256:${createHash('sha256').update(canonicalJson(value)).digest('hex')}`;
}

function canonicalJson(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  return `{${Object.entries(value).sort(([left], [right]) => left.localeCompare(right))
    .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(',')}}`;
}
