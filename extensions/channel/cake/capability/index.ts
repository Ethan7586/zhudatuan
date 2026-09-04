import { CakeOrderSubmitter } from './OrderSubmitter';
import { CakeProductSource } from './ProductSource';
import { CakeRefundProvider } from './RefundProvider';
import { CakeStatementSource } from './StatementSource';
import { CakeStockSource } from './StockSource';

export * from './OrderSubmitter';
export * from './ProductSource';
export * from './RefundProvider';
export * from './StatementSource';
export * from './StockSource';
export * from './WebhookVerifier';

export const CakeCapabilities = Object.freeze({ ...CakeProductSource, ...CakeStockSource, ...CakeOrderSubmitter, ...CakeRefundProvider, ...CakeStatementSource });
