import { expect, it } from 'vitest';
import { assertProviderMappingFailure } from '@shop/providercore/test';
import { CakeMapper } from '../integration';

it('rejects incomplete cake records', () => expect(() => assertProviderMappingFailure(new CakeMapper())).not.toThrow());
