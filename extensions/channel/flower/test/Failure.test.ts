import { expect, it } from 'vitest';
import { assertProviderFailure } from '@shop/providercore/test';
import { mapFlowerError } from '../integration';
import { manifest } from '../Manifest';

it('fails flower closed without leaking raw errors', () => expect(() => assertProviderFailure(mapFlowerError, 'FLOWER', manifest)).not.toThrow());
