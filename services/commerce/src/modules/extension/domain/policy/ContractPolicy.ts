import { manifestPayload, PROVIDER_API_VERSION, type ProviderDependency, type ProviderManifest, type UnsignedProviderManifest } from '@shop/contract';

export interface ManifestConfiguration {
  readonly baseUrl: string | null;
  readonly endpoints: Readonly<Record<string, string>>;
  readonly secretRef: string | null | undefined;
  readonly healthOperation: string;
}

export class ContractPolicy {
  assert(actual: ProviderManifest, expected: UnsignedProviderManifest): void {
    if (actual.apiVersion !== PROVIDER_API_VERSION) throw new Error('EXTENSION_API_VERSION_MISMATCH');
    if (manifestPayload(actual) !== manifestPayload({ ...expected, signature: actual.signature })) throw new Error('EXTENSION_CONTRACT_MISMATCH');
    if (new Set(actual.capabilities).size !== actual.capabilities.length) throw new Error('EXTENSION_CAPABILITY_DUPLICATE');
    this.assertPermissions(actual);
    const match = new RegExp(`^${escape(actual.id)}\\.v([1-9][0-9]*)$`).exec(actual.contractVersion);
    if (!match || actual.configSchema !== `provider.${actual.id}.v${match[1]}`) throw new Error('EXTENSION_CONFIGURATION_SCHEMA_MISMATCH');
  }

  assertDependencies(root: ProviderManifest, available: readonly ProviderManifest[]): void {
    const manifests = new Map<string, ProviderManifest>();
    for (const manifest of [root, ...available]) {
      const key = dependencyKey(manifest.id, manifest.version);
      const current = manifests.get(key);
      if (current && manifestPayload(current) !== manifestPayload(manifest)) throw new Error('EXTENSION_DEPENDENCY_AMBIGUOUS:' + key);
      manifests.set(key, manifest);
    }
    const visiting = new Set<string>();
    const visited = new Set<string>();
    const visit = (manifest: ProviderManifest): void => {
      const key = dependencyKey(manifest.id, manifest.version);
      if (visiting.has(key)) throw new Error('EXTENSION_DEPENDENCY_CYCLE:' + key);
      if (visited.has(key)) return;
      visiting.add(key);
      for (const dependency of manifest.dependencies) {
        const target = manifests.get(dependencyKey(dependency.id, dependency.version));
        if (!target) {
          const versions = [...manifests.values()].filter(({ id }) => id === dependency.id).map(({ version }) => version).sort();
          if (versions.length > 0) throw new Error(`EXTENSION_DEPENDENCY_VERSION_MISMATCH:${dependencyKey(dependency.id, dependency.version)}:${versions.join(',')}`);
          throw new Error('EXTENSION_DEPENDENCY_MISSING:' + dependencyKey(dependency.id, dependency.version));
        }
        assertDependencyCapabilities(dependency, target);
        visit(target);
      }
      visiting.delete(key);
      visited.add(key);
    };
    visit(root);
  }

  assertConfiguration(manifest: ProviderManifest, input: ManifestConfiguration, preserveSecret = false): void {
    if (input.healthOperation !== manifest.healthOperation) throw new Error('PROVIDER_HEALTH_OPERATION_MISMATCH');
    assertEndpoints(input.endpoints);
    const local = manifest.sandbox.mode === 'local';
    if (local) {
      if (manifest.secretRefs.length !== 0 || input.baseUrl !== null || input.secretRef != null || Object.keys(input.endpoints).length !== 0) {
        throw new Error('PROVIDER_LOCAL_CONFIGURATION_INVALID');
      }
      return;
    }
    const secretAvailable = (preserveSecret && input.secretRef === undefined) || (typeof input.secretRef === 'string' && /^[a-z0-9][a-z0-9/.-]{2,255}$/.test(input.secretRef));
    if (manifest.secretRefs.length !== 1 || !secureBaseUrl(input.baseUrl) || !secretAvailable || !input.endpoints[manifest.healthOperation]) {
      throw new Error('PROVIDER_CONNECTION_CONFIGURATION_INVALID');
    }
  }

  private assertPermissions(manifest: ProviderManifest): void {
    const expected = `channel.${manifest.id}.operate`;
    if (manifest.permissions.length !== 1 || manifest.permissions[0] !== expected) throw new Error('EXTENSION_PERMISSION_NOT_MINIMAL');
  }
}

function dependencyKey(id: string, version: string): string {
  return `${id}@${version}`;
}

function assertDependencyCapabilities(dependency: ProviderDependency, target: ProviderManifest): void {
  const missing = dependency.capabilities.filter((capability) => !target.capabilities.includes(capability));
  if (missing.length > 0) throw new Error(`EXTENSION_DEPENDENCY_CAPABILITY_MISMATCH:${dependencyKey(dependency.id, dependency.version)}:${missing.join(',')}`);
}

function assertEndpoints(endpoints: Readonly<Record<string, string>>): void {
  const entries = Object.entries(endpoints);
  if (entries.length > 64 || entries.some(([operation, path]) => !/^[a-z][a-z0-9]{0,63}$/.test(operation) || !/^\/(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))[A-Za-z0-9._~!$&'()*+,;=:@%/-]{0,1023}$/.test(path))) {
    throw new Error('PROVIDER_CONNECTION_CONFIGURATION_INVALID');
  }
}

function secureBaseUrl(value: string | null): boolean {
  if (!value || value.length > 2048) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && Boolean(url.hostname) && !url.username && !url.password && !url.search && !url.hash;
  } catch {
    return false;
  }
}

function escape(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
