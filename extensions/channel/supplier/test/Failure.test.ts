import { expect, it } from 'vitest';
import { assertProviderFailure } from '@shop/providercore/test';
import { mapSupplierError } from '../integration';
import { manifest } from '../Manifest';

it('fails supplier closed without leaking raw errors', () => expect(() => assertProviderFailure(mapSupplierError, 'SUPPLIER', manifest)).not.toThrow());
