export interface PaymentAllocation {
  welfare: number;
  meal: number;
  external: number;
}

const toCents = (value: number): number => Math.max(0, Math.round((Number.isFinite(value) ? value : 0) * 100));

/**
 * 统一计算订单的福利卡、餐卡与外部补差金额。
 * 所有计算以“分”为单位，避免浮点误差，并保证三项合计永不超过订单金额。
 */
export const calculatePaymentAllocation = (orderTotal: number, requestedWelfare: number, requestedMeal: number, welfareBalance: number, mealBalance: number): PaymentAllocation => {
  const totalCents = toCents(orderTotal);
  const welfareCents = Math.min(toCents(requestedWelfare), toCents(welfareBalance), totalCents);
  const remainingAfterWelfare = totalCents - welfareCents;
  const mealCents = Math.min(toCents(requestedMeal), toCents(mealBalance), remainingAfterWelfare);
  const externalCents = totalCents - welfareCents - mealCents;

  return {
    welfare: welfareCents / 100,
    meal: mealCents / 100,
    external: externalCents / 100,
  };
};
