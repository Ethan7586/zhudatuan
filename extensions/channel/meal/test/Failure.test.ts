import { expect, it } from 'vitest';
import { assertProviderFailure } from '@shop/providercore/test';
import { mapMealError } from '../integration';
import { manifest } from '../Manifest';

it('fails meal closed without leaking raw errors', () => expect(() => assertProviderFailure(mapMealError, 'MEAL', manifest)).not.toThrow());
