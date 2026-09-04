import { JdproductOrderSubmitter } from './OrderSubmitter';
import { JdproductPriceSource } from './PriceSource';
import { JdproductProductSource } from './ProductSource';
import { JdproductRefundProvider } from './RefundProvider';
import { JdproductStatementSource } from './StatementSource';
import { JdproductStockSource } from './StockSource';

export * from './OrderSubmitter';
export * from './PriceSource';
export * from './ProductSource';
export * from './RefundProvider';
export * from './StatementSource';
export * from './StockSource';
export * from './WebhookVerifier';

export const JdproductCapabilities = Object.freeze({ ...JdproductProductSource, ...JdproductPriceSource, ...JdproductStockSource, ...JdproductOrderSubmitter, ...JdproductRefundProvider, ...JdproductStatementSource });
