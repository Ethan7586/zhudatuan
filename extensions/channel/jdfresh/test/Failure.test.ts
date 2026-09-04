import { expect, it } from 'vitest';
import { assertProviderFailure } from '@shop/providercore/test';
import { mapJdfreshError } from '../integration';
import { manifest } from '../Manifest';

it('fails jdfresh closed without leaking raw errors', () => expect(() => assertProviderFailure(mapJdfreshError, 'JDFRESH', manifest)).not.toThrow());
