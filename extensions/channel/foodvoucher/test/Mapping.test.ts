import { expect, it } from 'vitest';
import { assertProviderMappingFailure } from '@shop/providercore/test';
import { FoodvoucherMapper } from '../integration';

it('rejects incomplete foodvoucher records', () => expect(() => assertProviderMappingFailure(new FoodvoucherMapper())).not.toThrow());

it('rejects unknown e-code states', () => expect(() => new FoodvoucherMapper().objects([{ voucherProductId: 'F-1', updatedAt: 'v1', storeIds: ['S-1'], codeReference: 'secretref://code', codeState: 'plain-text-code' }], 'mapping')).toThrow('FOODVOUCHER_STATE_INVALID'));
