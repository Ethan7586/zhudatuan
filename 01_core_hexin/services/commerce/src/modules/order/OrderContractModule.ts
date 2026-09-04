import type { OperationDatabase } from '../../foundation/application/ModuleOperations';
import type { CheckoutQuote } from '../checkout/CheckoutContractModule';

export interface StoredQuote {
  readonly checkout: string;
  readonly cart_id: string;
  readonly member_id: string;
  readonly mall_id: string;
  readonly application_id: string;
  readonly quote_id: string;
  readonly quote_hash: string;
  readonly input: Readonly<Record<string, unknown>>;
  readonly version: number;
  readonly signed_payload: CheckoutQuote;
  readonly signature: string;
}

export interface OrderQuoteStore {
  load(database: OperationDatabase, quote: string, membership: string): Promise<StoredQuote>;
}
