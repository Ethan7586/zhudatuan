import type { ProviderCapability, ProviderPortForCapability } from '@shop/contract';
import type { ExtensionRegistry } from '../../../../bootstrap/ExtensionRegistry';
import type { ManifestVerifier } from '../../../../bootstrap/SignatureVerifier';
import type { ReadTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import { DisableExtension } from '../../application/service/DisableExtension';
import { EnableExtension } from '../../application/service/EnableExtension';
import { InstallExtension } from '../../application/service/InstallExtension';
import type { ExtensionLoader, ExtensionRepository } from '../../application/port/ExtensionLoader';
import { ContractPolicy } from '../../domain/policy/ContractPolicy';
import type { ExtensionRegistryPort } from '../../public/ExtensionRegistry';

export function extensionRegistryAdapter(
  registry: ExtensionRegistry,
  repository: ExtensionRepository,
  verifier: ManifestVerifier,
  loader: ExtensionLoader
): ExtensionRegistryPort {
  return Object.freeze({
    strategy<C extends ProviderCapability>(provider: string, scope: string, capability: C | readonly C[]): ProviderPortForCapability<C> {
      return registry.strategy(provider, scope, capability);
    },
    install: () => new InstallExtension(repository, verifier, new ContractPolicy(), loader),
    enable: () => new EnableExtension(repository, loader),
    disable: () => new DisableExtension(repository, loader),
    summaries: (context: ReadTransactionContext, installations: readonly string[]) => repository.summaries(context, installations),
  });
}
