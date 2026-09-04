import { BookOrderSubmitter } from './OrderSubmitter';
import { BookPriceSource } from './PriceSource';
import { BookProductSource } from './ProductSource';
import { BookRefundProvider } from './RefundProvider';
import { BookStatementSource } from './StatementSource';
import { BookStockSource } from './StockSource';

export * from './OrderSubmitter';
export * from './PriceSource';
export * from './ProductSource';
export * from './RefundProvider';
export * from './StatementSource';
export * from './StockSource';
export * from './WebhookVerifier';

export const BookCapabilities = Object.freeze({ ...BookProductSource, ...BookPriceSource, ...BookStockSource, ...BookOrderSubmitter, ...BookRefundProvider, ...BookStatementSource });
