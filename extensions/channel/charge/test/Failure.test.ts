import { expect, it } from 'vitest';
import { assertProviderFailure } from '@shop/providercore/test';
import { mapChargeError } from '../integration';
import { manifest } from '../Manifest';

it('fails charge closed without leaking raw errors', () => expect(() => assertProviderFailure(mapChargeError, 'CHARGE', manifest)).not.toThrow());
