import { expect, it } from 'vitest';
import { assertProviderFailure } from '@shop/providercore/test';
import { mapJdproductError } from '../integration';
import { manifest } from '../Manifest';

it('fails jdproduct closed without leaking raw errors', () => expect(() => assertProviderFailure(mapJdproductError, 'JDPRODUCT', manifest)).not.toThrow());
