import { expect, it } from 'vitest';
import { assertProviderMappingFailure } from '@shop/providercore/test';
import { JdfreshMapper } from '../integration';

it('rejects incomplete jdfresh records', () => expect(() => assertProviderMappingFailure(new JdfreshMapper())).not.toThrow());

it('rejects unsupported temperature bands', () => expect(() => new JdfreshMapper().objects([{ skuId: 'FRESH-1', updatedAt: 'v1', weightGram: 500, temperatureBand: 'hot', deliverySlots: ['now'], regions: ['310000'], substitutes: [] }], 'mapping')).toThrow('JDFRESH_TEMPERATURE_INVALID'));
