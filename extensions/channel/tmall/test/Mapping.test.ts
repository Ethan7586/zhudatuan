import { expect, it } from 'vitest';
import { assertProviderMappingFailure } from '@shop/providercore/test';
import { TmallMapper } from '../integration';

it('rejects incomplete tmall records', () => expect(() => assertProviderMappingFailure(new TmallMapper())).not.toThrow());
