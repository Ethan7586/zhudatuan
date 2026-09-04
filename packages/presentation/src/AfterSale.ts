import { ORDER_AFTERSALE_REASONS, type OrderAfterSaleReason } from '@shop/contract';

const reasonTexts = Object.freeze(['商品质量问题', '运输破损', '错发或漏发', '不再需要', '服务未按约完成'] as const satisfies Readonly<Record<number, string>>);

export const afterSaleReasonOptions = Object.freeze(
  ORDER_AFTERSALE_REASONS.map((value, index) => Object.freeze({ value, label: reasonTexts[index] ?? value }))
);

export function afterSaleReasonText(value: string): string {
  return afterSaleReasonOptions.find((option) => option.value === value)?.label ?? '其他售后原因';
}

export function isOrderAfterSaleReason(value: string): value is OrderAfterSaleReason {
  return (ORDER_AFTERSALE_REASONS as readonly string[]).includes(value);
}
