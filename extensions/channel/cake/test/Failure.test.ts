import { expect, it } from 'vitest';
import { assertProviderFailure } from '@shop/providercore/test';
import { mapCakeError } from '../integration';
import { manifest } from '../Manifest';

it('fails cake closed without leaking raw errors', () => expect(() => assertProviderFailure(mapCakeError, 'CAKE', manifest)).not.toThrow());
