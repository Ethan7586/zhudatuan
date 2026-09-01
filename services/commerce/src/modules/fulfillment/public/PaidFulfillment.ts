import type { OrderFulfillmentPlan } from '../../order/public';

export interface PaidFulfillment {
  readonly order: string;
  readonly payment: string;
  readonly plans: readonly OrderFulfillmentPlan[];
}
