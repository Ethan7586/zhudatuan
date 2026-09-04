import type { ReadTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { MemberAccessPort } from '../../../access/public';
import type { BenefitGateway } from '../../../benefit/public';
import type { CartReadPort } from '../../../cart/public';
import type { CheckoutCatalogPort } from '../../../catalog/public';
import type { CheckoutExperiencePort } from '../../../experience/public';
import type { CheckoutInvoicePort } from '../../../finance/public';
import type { CheckoutInventoryPort } from '../../../inventory/public';
import type { MarketingReadPort } from '../../../marketing/public';
import type { MemberAddressPort } from '../../../member/public';
import type { OrderIntentPort } from '../../../order/public';
import type { CheckoutPricingPort } from '../../../pricing/public';
import type { CheckoutQualificationPort } from '../../../qualification/public';
import type { RiskDecisionPort } from '../../../risk/public';

export interface QuoteVoucherChoice {
  readonly id: string;
  readonly remainingMinor: number;
  readonly version: number;
  readonly product: string;
}

export interface QuoteVoucherGateway {
  preview(context: ReadTransactionContext, vouchers: readonly string[], member: string, scope: string): Promise<readonly QuoteVoucherChoice[]>;
}

export interface QuoteReaderDependencies {
  readonly access: MemberAccessPort;
  readonly address: MemberAddressPort;
  readonly benefit: Pick<BenefitGateway, 'preview'>;
  readonly cart: CartReadPort;
  readonly catalog: CheckoutCatalogPort;
  readonly experience: CheckoutExperiencePort;
  readonly invoice: CheckoutInvoicePort;
  readonly inventory: CheckoutInventoryPort;
  readonly marketing: Pick<MarketingReadPort, 'evaluate'>;
  readonly orders: OrderIntentPort;
  readonly pricing: CheckoutPricingPort;
  readonly qualification: CheckoutQualificationPort;
  readonly risk: RiskDecisionPort;
  readonly voucher: QuoteVoucherGateway;
}

export function quoteRecordNumber(value: unknown, key: string): number | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;
  const result = (value as Readonly<Record<string, unknown>>)[key];
  return typeof result === 'number' && Number.isSafeInteger(result) ? result : null;
}

export function quoteRecordText(value: unknown, key: string): string | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;
  const result = (value as Readonly<Record<string, unknown>>)[key];
  return typeof result === 'string' ? result : null;
}
