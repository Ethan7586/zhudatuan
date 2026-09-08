import { readFile } from 'node:fs/promises';

import {
  SFL_NODE_MANIFEST_SCHEMA_VERSION,
  deserializeNodeManifest,
  parseNodeManifest,
  type NodeManifest,
  type NodeProfile,
  type SignedLevel,
} from './SflNodeKernel';

export const NODE_MANIFEST_SCHEMA_VERSION = SFL_NODE_MANIFEST_SCHEMA_VERSION;

export type { NodeManifest, NodeProfile, SignedLevel };
export { parseNodeManifest };

export interface NodeManifestRuntimeExpectation {
  readonly manifestId: string;
  readonly manifestDigest: string;
  readonly runtimeInstanceId: string;
  readonly runtimeConfigRef: string;
  readonly resourceBindingVersion: string;
  readonly releasePointerRef: string;
}

export async function loadNodeManifest(
  path: string,
  expectation?: NodeManifestRuntimeExpectation,
): Promise<NodeManifest> {
  const manifest = await deserializeNodeManifest(await readFile(path, 'utf8'));
  if (expectation) assertNodeManifestRuntime(manifest, expectation);
  return manifest;
}

export function assertNodeManifestRuntime(
  manifest: NodeManifest,
  expectation: NodeManifestRuntimeExpectation,
): void {
  const pairs = [
    [manifest.manifest_id, expectation.manifestId, 'NODE_MANIFEST_ID_MISMATCH'],
    [manifest.manifest_digest, expectation.manifestDigest, 'NODE_MANIFEST_DIGEST_MISMATCH'],
    [manifest.runtime_instance_id, expectation.runtimeInstanceId, 'NODE_MANIFEST_RUNTIME_INSTANCE_MISMATCH'],
    [manifest.runtime_config_ref.ref, expectation.runtimeConfigRef, 'NODE_MANIFEST_RUNTIME_CONFIG_MISMATCH'],
    [manifest.resource_binding_set_ref.version, expectation.resourceBindingVersion,
      'NODE_MANIFEST_RESOURCE_BINDING_VERSION_MISMATCH'],
    [manifest.release_pointer_ref.ref, expectation.releasePointerRef, 'NODE_MANIFEST_RELEASE_POINTER_MISMATCH'],
  ] as const;
  for (const [actual, expected, code] of pairs) if (actual !== expected) throw new Error(code);
}

export function nodeManifestHasFeature(manifest: NodeManifest, feature: string): boolean {
  const reference = feature.startsWith('feature:') ? feature : `feature:${feature}`;
  return manifest.enabled_features.some((candidate) => candidate.ref === reference);
}

export function nodeManifestHasSurface(manifest: NodeManifest, surface: string): boolean {
  const reference = surface.startsWith('surface:') ? surface : `surface:${surface}`;
  return manifest.surfaces.some((candidate) => candidate.ref === reference);
}

export function nodeManifestOrigins(manifest: NodeManifest, surface?: string): readonly string[] {
  const reference = surface === undefined
    ? undefined
    : surface.startsWith('surface:') ? surface : `surface:${surface}`;
  return Object.freeze(manifest.domain_bindings
    .filter((binding) => reference === undefined || binding.surface_ref === reference)
    .map((binding) => `https://${binding.host}`));
}
