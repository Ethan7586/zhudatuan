import { describe, expect, it } from 'vitest';
import { parseCreateAfterSaleInput, parseCreateOrderInput, parseExecuteRefundInput, parseInternalPaymentInput, parseSimulationBenefitInput, parseSimulationMixedPaymentInput, parseSimulationRechargeInput } from './validation';

const validInput = {
  items: [{ skuId: 'sku-rice-5kg', quantity: 2 }],
  recipient: {
    name: '张三',
    mobile: '13800138000',
    province: '湖北省',
    city: '武汉市',
    district: '武昌区',
    address: '友谊大道100号',
  },
};

describe('parseCreateOrderInput', () => {
  it('accepts a valid order', () => {
    expect(parseCreateOrderInput(validInput)).toEqual(validInput);
  });

  it('rejects duplicate SKUs', () => {
    expect(
      parseCreateOrderInput({
        ...validInput,
        items: [
          { skuId: 'sku-rice-5kg', quantity: 1 },
          { skuId: 'sku-rice-5kg', quantity: 2 },
        ],
      })
    ).toBeNull();
  });

  it('rejects invalid quantities and phone numbers', () => {
    expect(
      parseCreateOrderInput({
        ...validInput,
        items: [{ skuId: 'sku-rice-5kg', quantity: 0 }],
      })
    ).toBeNull();
    expect(
      parseCreateOrderInput({
        ...validInput,
        recipient: { ...validInput.recipient, mobile: '123' },
      })
    ).toBeNull();
  });
});

describe('parseCreateAfterSaleInput', () => {
  it('accepts a scoped after-sale request', () => {
    expect(
      parseCreateAfterSaleInput({
        orderId: 'order-1',
        type: 'return_refund',
        reason: '商品外包装破损',
        requestedAmountCents: 8900,
      })
    ).toEqual({
      orderId: 'order-1',
      type: 'return_refund',
      reason: '商品外包装破损',
      requestedAmountCents: 8900,
    });
  });

  it('rejects unsupported types and invalid amounts', () => {
    expect(
      parseCreateAfterSaleInput({
        orderId: 'order-1',
        type: 'cash_refund',
        reason: '商品外包装破损',
        requestedAmountCents: 8900,
      })
    ).toBeNull();
    expect(
      parseCreateAfterSaleInput({
        orderId: 'order-1',
        type: 'refund_only',
        reason: '破损',
        requestedAmountCents: 0,
      })
    ).toBeNull();
  });
});

describe('parseInternalPaymentInput', () => {
  it('accepts a valid mixed internal payment', () => {
    expect(parseInternalPaymentInput({ welfareCents: 8000, mealCents: 900 })).toEqual({
      welfareCents: 8000,
      mealCents: 900,
    });
  });

  it('rejects zero, negative and fractional allocations', () => {
    expect(parseInternalPaymentInput({ welfareCents: 0, mealCents: 0 })).toBeNull();
    expect(parseInternalPaymentInput({ welfareCents: -1, mealCents: 100 })).toBeNull();
    expect(parseInternalPaymentInput({ welfareCents: 10.5, mealCents: 0 })).toBeNull();
  });
});

describe('parseExecuteRefundInput', () => {
  it('only accepts positive whole-cent refunds', () => {
    expect(parseExecuteRefundInput({ refundCents: 500 })).toEqual({ refundCents: 500 });
    expect(parseExecuteRefundInput({ refundCents: 0 })).toBeNull();
    expect(parseExecuteRefundInput({ refundCents: 1.5 })).toBeNull();
  });
});

describe('test payment simulation validation', () => {
  it('only accepts explicitly mocked recharge channels', () => {
    expect(parseSimulationRechargeInput({ accountType: 'welfare', channel: 'wechat_mock', amountCents: 10000 })).toEqual({ accountType: 'welfare', channel: 'wechat_mock', amountCents: 10000 });
    expect(parseSimulationRechargeInput({ accountType: 'welfare', channel: 'wechat', amountCents: 10000 })).toBeNull();
  });

  it('requires an owned voucher whenever voucher cents are used', () => {
    expect(parseSimulationMixedPaymentInput({ welfareCents: 100, mealCents: 0, voucherCents: 200, pointsCents: 50, externalChannel: 'alipay_mock', externalCents: 0 })).toBeNull();
    expect(parseSimulationMixedPaymentInput({ welfareCents: 100, mealCents: 0, voucherId: 'voucher-1', voucherCents: 200, pointsCents: 50, externalChannel: 'alipay_mock', externalCents: 0 })).toMatchObject({
      voucherId: 'voucher-1',
      externalChannel: 'alipay_mock',
    });
  });

  it('validates manager benefit grants', () => {
    expect(parseSimulationBenefitInput({ targetUserId: 'user-1', instrumentType: 'points', amount: 1000 })).toEqual({ targetUserId: 'user-1', instrumentType: 'points', amount: 1000 });
    expect(parseSimulationBenefitInput({ targetUserId: 'user-1', instrumentType: 'cash', amount: 1000 })).toBeNull();
  });
});
