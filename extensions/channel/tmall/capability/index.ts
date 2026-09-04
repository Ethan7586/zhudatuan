import { TmallOrderSubmitter } from './OrderSubmitter';
import { TmallPriceSource } from './PriceSource';
import { TmallProductSource } from './ProductSource';
import { TmallRefundProvider } from './RefundProvider';
import { TmallStatementSource } from './StatementSource';
import { TmallStockSource } from './StockSource';

export * from './OrderSubmitter';
export * from './PriceSource';
export * from './ProductSource';
export * from './RefundProvider';
export * from './StatementSource';
export * from './StockSource';
export * from './WebhookVerifier';

export const TmallCapabilities = Object.freeze({ ...TmallProductSource, ...TmallPriceSource, ...TmallStockSource, ...TmallOrderSubmitter, ...TmallRefundProvider, ...TmallStatementSource });
