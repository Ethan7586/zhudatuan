import { describe, expect, it, vi } from 'vitest';
import type { CatalogSource } from '@shop/contract';
import type { ExtensionRegistry } from '../../../composition/ExtensionRegistry';
import { PgTransactionAccess } from '../../../platform/database/PgTransactionAccess';
import { Manifest } from '../Manifest';
import { extensionRegistryAdapter } from '../infrastructure/adapter/ExtensionRegistryAdapter';
import { PgExtensionRepository } from '../infrastructure/persistence/PgExtensionRepository';
import type { ExtensionLoader } from '../application/port/ExtensionLoader';
import type { ManifestVerifier } from '../../../composition/SignatureVerifier';

describe('extension registry public facade', () => {
  it('resolves a strategy by capability without exposing persistence or package details', () => {
    const catalog: CatalogSource = { pullCatalog: async () => ({ records: [], errors: [], complete: true }) };
    const strategy = vi.fn(() => catalog);
    const registry = { strategy } as unknown as ExtensionRegistry;
    const port = extensionRegistryAdapter(registry, new PgExtensionRepository(new PgTransactionAccess()), {} as ManifestVerifier, {} as ExtensionLoader);

    expect(port.strategy('sample', 'scope:1', 'Catalog')).toBe(catalog);
    expect(strategy).toHaveBeenCalledWith('sample', 'scope:1', 'Catalog');
    expect(Object.hasOwn(port, 'repository')).toBe(false);
    expect(Object.keys(port).sort()).toEqual(['disable', 'enable', 'install', 'strategy', 'summaries']);
  });

  it('declares the runtime registry needed by its single loader composition point', () => {
    expect(Manifest.workloads.api.services).toContain('extension.registry');
  });
});
