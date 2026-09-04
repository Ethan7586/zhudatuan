import { FoodvoucherOrderSubmitter } from './OrderSubmitter';
import { FoodvoucherProductSource } from './ProductSource';
import { FoodvoucherRefundProvider } from './RefundProvider';
import { FoodvoucherStatementSource } from './StatementSource';

export * from './OrderSubmitter';
export * from './ProductSource';
export * from './RefundProvider';
export * from './StatementSource';
export * from './WebhookVerifier';

export const FoodvoucherCapabilities = Object.freeze({ ...FoodvoucherProductSource, ...FoodvoucherOrderSubmitter, ...FoodvoucherRefundProvider, ...FoodvoucherStatementSource });
