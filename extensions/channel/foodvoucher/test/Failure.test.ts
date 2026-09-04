import { expect, it } from 'vitest';
import { assertProviderFailure } from '@shop/providercore/test';
import { mapFoodvoucherError } from '../integration';
import { manifest } from '../Manifest';

it('fails foodvoucher closed without leaking raw errors', () => expect(() => assertProviderFailure(mapFoodvoucherError, 'FOODVOUCHER', manifest)).not.toThrow());
