import type { OperationDatabase } from '../../../foundation/application/ModuleOperations';

export interface StoredCheckoutQuote {
  readonly checkout: string;
  readonly cart_id: string;
  readonly member_id: string;
  readonly mall_id: string;
  readonly application_id: string;
  readonly quote_id: string;
  readonly quote_hash: string;
  readonly input: Readonly<Record<string, unknown>>;
  readonly version: number;
}

export interface OrderCheckoutSessionPort {
  lockQuote(database: OperationDatabase, quote: string, member: string, mall: string): Promise<StoredCheckoutQuote>;
  confirm(database: OperationDatabase, checkout: string): Promise<void>;
}
