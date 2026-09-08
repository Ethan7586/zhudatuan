import { DomainError } from '../../../../platform/error/DomainError';
import type { ProviderManifest } from '@shop/contract';
import type { ManifestVerifier } from '../../../../composition/SignatureVerifier';
import type { WriteTransactionContext } from '../../../../platform/database/TransactionContext';
import { Extension } from '../../domain/model/Extension';
import { Manifest } from '../../domain/model/Manifest';
import type { Installation } from '../../domain/model/Installation';
import type { ContractPolicy } from '../../domain/policy/ContractPolicy';
import type { ExtensionLoader, ExtensionRepository } from '../port/ExtensionLoader';

export interface ExtensionInstallRequest {
  readonly id: string;
  readonly provider: string;
  readonly scope: string;
  readonly baseUrl: string | null;
  readonly endpoints: Readonly<Record<string, string>>;
  readonly secretRef: string | null;
  readonly healthOperation: string;
  readonly actor: string;
  readonly trace: string;
}

export interface InstalledExtension {
  readonly installation: Installation;
  readonly manifest: ProviderManifest;
}
export interface ExtensionConfiguration {
  readonly baseUrl: string | null;
  readonly endpoints: Readonly<Record<string, string>>;
  readonly secretRef: string | null | undefined;
  readonly healthOperation: string;
  readonly actor: string;
  readonly trace: string;
}

export class InstallExtension {
  constructor(
    private readonly repository: ExtensionRepository,
    private readonly verifier: ManifestVerifier,
    private readonly contracts: ContractPolicy,
    private readonly loader: ExtensionLoader
  ) {}

  async execute(context: WriteTransactionContext, input: ExtensionInstallRequest): Promise<InstalledExtension> {
    const registered = await this.repository.manifest(context, input.provider);
    if (!registered) throw new Error('PROVIDER_MANIFEST_NOT_REGISTERED');
    const parsed = parseRegistered(registered, input.provider);
    if (!(await this.verifier.verify(parsed.value))) throw new Error('EXTENSION_SIGNATURE_INVALID');
    this.contracts.assert(parsed.value, this.loader.definition(input.provider));
    await this.assertDependencies(context, parsed.value);
    new Extension(parsed);
    this.contracts.assertConfiguration(parsed.value, input);
    const installation = await this.repository.install(context, {
      id: input.id,
      scope: input.scope,
      baseUrl: input.baseUrl,
      endpoints: input.endpoints,
      secretRef: input.secretRef,
      healthOperation: input.healthOperation,
      actor: input.actor,
      trace: input.trace,
      manifest: parsed.value,
      manifestHash: parsed.hash,
    });
    return Object.freeze({ installation, manifest: parsed.value });
  }

  async reconfigure(context: WriteTransactionContext, id: string, scope: string, input: ExtensionConfiguration): Promise<void> {
    const repository = this.repository;
    const current = await repository.lock(context, id, scope);
    if (!current) throw new DomainError('RESOURCE_NOT_FOUND');
    const registered = await repository.manifest(context, current.extension, current.extensionVersion);
    if (!registered) throw new Error('PROVIDER_MANIFEST_NOT_REGISTERED');
    const parsed = parseRegistered(registered, current.extension);
    if (!(await this.verifier.verify(parsed.value))) throw new Error('EXTENSION_SIGNATURE_INVALID');
    this.contracts.assert(parsed.value, this.loader.definition(current.extension));
    await this.assertDependencies(context, parsed.value);
    this.contracts.assertConfiguration(parsed.value, input, true);
    await repository.reconfigure(context, id, scope, input);
  }

  private async assertDependencies(context: WriteTransactionContext, root: ProviderManifest): Promise<void> {
    if (root.dependencies.length === 0) {
      this.contracts.assertDependencies(root, []);
      return;
    }
    const records = await this.repository.manifests(context);
    const byKey = new Map(records.map((record) => [`${record.id}@${record.version}`, record]));
    const queue = [...root.dependencies];
    const loaded = new Map<string, ProviderManifest>();
    while (queue.length > 0) {
      const dependency = queue.shift();
      if (!dependency) break;
      const key = `${dependency.id}@${dependency.version}`;
      if (loaded.has(key)) continue;
      const registered = byKey.get(key);
      if (!registered) throw new Error('EXTENSION_DEPENDENCY_MISSING:' + key);
      const parsed = parseRegistered(registered, dependency.id);
      if (!(await this.verifier.verify(parsed.value))) throw new Error('EXTENSION_DEPENDENCY_SIGNATURE_INVALID:' + key);
      this.contracts.assert(parsed.value, this.loader.definition(dependency.id));
      loaded.set(key, parsed.value);
      queue.push(...parsed.value.dependencies);
    }
    this.contracts.assertDependencies(root, [...loaded.values()]);
  }
}

function parseRegistered(registered: import('../port/ExtensionLoader').RegisteredManifest, expectedId: string): Manifest {
  const parsed = Manifest.parse(manifestValue(registered.manifest, registered.signature), expectedId);
  if (parsed.value.version !== registered.version || parsed.value.contractVersion !== registered.contract_version || parsed.value.signature !== registered.signature || parsed.hash !== registered.manifest_hash.trim()) {
    throw new Error('PROVIDER_MANIFEST_STORAGE_INVALID');
  }
  return parsed;
}

function manifestValue(value: unknown, signature: string): unknown {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('PROVIDER_MANIFEST_INVALID');
  return { ...(value as Record<string, unknown>), signature };
}
