import { MealOrderSubmitter } from './OrderSubmitter';
import { MealPriceSource } from './PriceSource';
import { MealProductSource } from './ProductSource';
import { MealRefundProvider } from './RefundProvider';
import { MealStatementSource } from './StatementSource';
import { MealStockSource } from './StockSource';

export * from './OrderSubmitter';
export * from './PriceSource';
export * from './ProductSource';
export * from './RefundProvider';
export * from './StatementSource';
export * from './StockSource';
export * from './WebhookVerifier';

export const MealCapabilities = Object.freeze({ ...MealProductSource, ...MealPriceSource, ...MealStockSource, ...MealOrderSubmitter, ...MealRefundProvider, ...MealStatementSource });
