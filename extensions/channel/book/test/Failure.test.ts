import { expect, it } from 'vitest';
import { assertProviderFailure } from '@shop/providercore/test';
import { mapBookError } from '../integration';
import { manifest } from '../Manifest';

it('fails book closed without leaking raw errors', () => expect(() => assertProviderFailure(mapBookError, 'BOOK', manifest)).not.toThrow());
