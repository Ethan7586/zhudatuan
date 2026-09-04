import { expect, it } from 'vitest';
import { assertProviderMappingFailure } from '@shop/providercore/test';
import { ChargeMapper, validateChargeNumber } from '../integration';

it('rejects incomplete charge records', () => expect(() => assertProviderMappingFailure(new ChargeMapper())).not.toThrow());

it('rejects invalid recharge targets', () => expect(() => validateChargeNumber('phone', '10086')).toThrow('CHARGE_PHONE_INVALID'));
