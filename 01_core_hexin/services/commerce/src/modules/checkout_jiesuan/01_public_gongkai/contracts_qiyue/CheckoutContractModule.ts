import type { OperationDatabase } from '../../../../foundation/application/ModuleOperations';
import type { CheckoutQuote, CheckoutSelection } from '../../02_domain_yewu/models_moxing/CheckoutQuote';

export type { CheckoutQuote, CheckoutSelection };

export interface QuoteCartContext {
  readonly id: string;
  readonly member_id: string;
  readonly mall_id: string;
  readonly application_id: string;
  readonly version: number;
  readonly profile_status: string | null;
  readonly profile_version: number | null;
  readonly city_code: string | null;
  readonly address_version: number | null;
  readonly address_region: string | null;
  readonly invoice_version: number | null;
  readonly experience_version: string | null;
  readonly experience_hash: string | null;
}

export interface QuoteContextReader {
  read(database: OperationDatabase, membership: string, selection: CheckoutSelection): Promise<QuoteCartContext>;
}
