import { expect, it } from 'vitest';
import { assertProviderCatalog, assertProviderMappingFailure } from '@shop/providercore/test';
import { SupplierCatalog } from '../Catalog';
import { SupplierMapper } from '../integration';
import { definition } from '../Manifest';

it('validates supplier metadata and rejects incomplete records', () => expect(() => { assertProviderCatalog(definition, SupplierCatalog); assertProviderMappingFailure(new SupplierMapper()); }).not.toThrow());
