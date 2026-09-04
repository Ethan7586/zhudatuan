import { expect, it } from 'vitest';
import { assertProviderMappingFailure } from '@shop/providercore/test';
import { FlowerMapper } from '../integration';
import { flowerAvailability } from '../capability';

it('rejects incomplete flower records', () => expect(() => assertProviderMappingFailure(new FlowerMapper())).not.toThrow());

it('rejects unavailable flowers without a declared substitute', () => expect(() => flowerAvailability({ holiday: false, ordinaryLimit: 20, holidayLimit: 5, available: false, sku: 'F-1', substitutes: [] })).toThrow('FLOWER_SUBSTITUTE_UNAVAILABLE'));
