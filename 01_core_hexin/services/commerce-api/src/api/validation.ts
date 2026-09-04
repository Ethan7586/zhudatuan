export interface OrderItemInput {
  skuId: string;
  quantity: number;
}

export interface CreateOrderInput {
  items: OrderItemInput[];
  recipient: {
    name: string;
    mobile: string;
    province: string;
    city: string;
    district: string;
    address: string;
  };
}

export interface InternalPaymentInput {
  welfareCents: number;
  mealCents: number;
}

export interface CreateAfterSaleInput {
  orderId: string;
  type: 'refund_only' | 'return_refund' | 'exchange';
  reason: string;
  requestedAmountCents: number;
}

export interface ExecuteRefundInput {
  refundCents: number;
}

export interface SimulationRechargeInput {
  accountType: 'welfare' | 'meal';
  channel: 'wechat_mock' | 'alipay_mock' | 'unionpay_mock' | 'bank_mock';
  amountCents: number;
}

export interface SimulationBenefitInput {
  targetUserId: string;
  instrumentType: 'voucher' | 'points';
  amount: number;
}

export interface SimulationMixedPaymentInput {
  welfareCents: number;
  mealCents: number;
  voucherId: string | null;
  voucherCents: number;
  pointsCents: number;
  externalChannel: 'wechat_mock' | 'alipay_mock' | 'unionpay_mock' | 'bank_mock';
  externalCents: number;
}

export function parseCreateOrderInput(value: unknown): CreateOrderInput | null {
  if (!isRecord(value) || !Array.isArray(value.items) || !isRecord(value.recipient)) {
    return null;
  }

  if (value.items.length < 1 || value.items.length > 50) {
    return null;
  }

  const items: OrderItemInput[] = [];
  const seen = new Set<string>();
  for (const item of value.items) {
    if (!isRecord(item) || typeof item.skuId !== 'string' || item.skuId.length < 1 || item.skuId.length > 100 || !Number.isInteger(item.quantity) || (item.quantity as number) < 1 || (item.quantity as number) > 99 || seen.has(item.skuId)) {
      return null;
    }
    seen.add(item.skuId);
    items.push({ skuId: item.skuId, quantity: item.quantity as number });
  }

  const recipient = value.recipient;
  const name = readRequiredString(recipient, 'name', 50);
  const mobile = readRequiredString(recipient, 'mobile', 50);
  const province = readRequiredString(recipient, 'province', 50);
  const city = readRequiredString(recipient, 'city', 50);
  const district = readRequiredString(recipient, 'district', 50);
  const address = readRequiredString(recipient, 'address', 200);
  if (!name || !mobile || !province || !city || !district || !address) {
    return null;
  }

  if (!/^1\d{10}$/.test(mobile)) {
    return null;
  }

  return {
    items,
    recipient: {
      name,
      mobile,
      province,
      city,
      district,
      address,
    },
  };
}

export function parseInternalPaymentInput(value: unknown): InternalPaymentInput | null {
  if (!isRecord(value)) {
    return null;
  }
  const welfareCents = value.welfareCents;
  const mealCents = value.mealCents;
  if (!Number.isSafeInteger(welfareCents) || !Number.isSafeInteger(mealCents) || (welfareCents as number) < 0 || (mealCents as number) < 0 || (welfareCents as number) + (mealCents as number) <= 0) {
    return null;
  }
  return {
    welfareCents: welfareCents as number,
    mealCents: mealCents as number,
  };
}

export function parseCreateAfterSaleInput(value: unknown): CreateAfterSaleInput | null {
  if (!isRecord(value)) return null;
  const orderId = readRequiredString(value, 'orderId', 100);
  const reason = readRequiredString(value, 'reason', 500);
  const type = value.type;
  const requestedAmountCents = value.requestedAmountCents;
  if (!orderId || !reason || !['refund_only', 'return_refund', 'exchange'].includes(String(type)) || !Number.isSafeInteger(requestedAmountCents) || (requestedAmountCents as number) <= 0) {
    return null;
  }
  return {
    orderId,
    reason,
    type: type as CreateAfterSaleInput['type'],
    requestedAmountCents: requestedAmountCents as number,
  };
}

export function parseExecuteRefundInput(value: unknown): ExecuteRefundInput | null {
  if (!isRecord(value) || !Number.isSafeInteger(value.refundCents)) {
    return null;
  }
  const refundCents = value.refundCents as number;
  return refundCents > 0 ? { refundCents } : null;
}

export function parseSimulationRechargeInput(value: unknown): SimulationRechargeInput | null {
  if (!isRecord(value) || !['welfare', 'meal'].includes(String(value.accountType)) || !['wechat_mock', 'alipay_mock', 'unionpay_mock', 'bank_mock'].includes(String(value.channel)) || !Number.isSafeInteger(value.amountCents)) return null;
  const amountCents = value.amountCents as number;
  return amountCents > 0 && amountCents <= 100000000 ? { accountType: value.accountType as SimulationRechargeInput['accountType'], channel: value.channel as SimulationRechargeInput['channel'], amountCents } : null;
}

export function parseSimulationBenefitInput(value: unknown): SimulationBenefitInput | null {
  if (!isRecord(value) || typeof value.targetUserId !== 'string' || value.targetUserId.length < 1 || value.targetUserId.length > 120 || !['voucher', 'points'].includes(String(value.instrumentType)) || !Number.isSafeInteger(value.amount))
    return null;
  const amount = value.amount as number;
  return amount > 0 && amount <= 100000000 ? { targetUserId: value.targetUserId, instrumentType: value.instrumentType as SimulationBenefitInput['instrumentType'], amount } : null;
}

export function parseSimulationMixedPaymentInput(value: unknown): SimulationMixedPaymentInput | null {
  if (!isRecord(value)) return null;
  const values = ['welfareCents', 'mealCents', 'voucherCents', 'pointsCents', 'externalCents'].map((key) => value[key]);
  if (values.some((item) => !Number.isSafeInteger(item) || (item as number) < 0) || !['wechat_mock', 'alipay_mock', 'unionpay_mock', 'bank_mock'].includes(String(value.externalChannel))) return null;
  const voucherId = value.voucherId === undefined || value.voucherId === null ? null : typeof value.voucherId === 'string' && value.voucherId.length <= 120 ? value.voucherId : undefined;
  if (voucherId === undefined || ((value.voucherCents as number) > 0 && !voucherId)) return null;
  const total = (values as unknown[]).reduce<number>((sum, item) => sum + (item as number), 0);
  return total > 0
    ? {
        welfareCents: value.welfareCents as number,
        mealCents: value.mealCents as number,
        voucherId,
        voucherCents: value.voucherCents as number,
        pointsCents: value.pointsCents as number,
        externalChannel: value.externalChannel as SimulationMixedPaymentInput['externalChannel'],
        externalCents: value.externalCents as number,
      }
    : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readRequiredString(record: Record<string, unknown>, key: string, maxLength: number): string | null {
  const value = record[key];
  if (typeof value !== 'string') {
    return null;
  }
  const normalized = value.trim();
  return normalized.length > 0 && normalized.length <= maxLength ? normalized : null;
}
