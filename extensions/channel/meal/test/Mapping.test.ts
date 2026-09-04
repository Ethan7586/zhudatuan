import { expect, it } from 'vitest';
import { assertProviderMappingFailure } from '@shop/providercore/test';
import { MealMapper } from '../integration';

it('rejects incomplete meal records', () => expect(() => assertProviderMappingFailure(new MealMapper())).not.toThrow());
