import { expect, it } from 'vitest';
import { assertProviderMappingFailure } from '@shop/providercore/test';
import { JdproductMapper } from '../integration';

it('rejects incomplete jdproduct records', () => expect(() => assertProviderMappingFailure(new JdproductMapper())).not.toThrow());
