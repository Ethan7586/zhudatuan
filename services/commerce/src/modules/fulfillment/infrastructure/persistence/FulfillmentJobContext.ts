import type { JsonObject, ProviderOperationResult } from '@shop/contract';
import type { ProviderOperationPort } from '../../../channel/public';
import type { OrderFulfillmentPort } from '../../../order/public';
import type { OrganizationReadPort } from '../../../organization/public';
import type { FulfillmentVoucherPort } from '../../../voucher/public';

export interface FulfillmentRow {
  readonly id: string;
  readonly order_id: string;
  readonly provider: string | null;
  readonly scope_id: string;
  readonly member_id: string;
  readonly state: string;
  readonly route: 'physical' | 'digital' | 'voucher' | 'channel';
  readonly kind: 'shipment' | 'delivery' | 'pickup' | 'service' | 'digital';
  readonly version: number;
  readonly external_reference: string | null;
  readonly lines: JsonObject[];
}

export interface ReturnPlan {
  readonly id: string;
  readonly fulfillment: string;
  readonly group: Readonly<{ provider: string | null; lines: readonly Readonly<{ line: string; quantity: number }>[] }>;
  readonly providerReference: string | null;
  readonly instruction: JsonObject;
  readonly providerResult: ProviderOperationResult | null;
  readonly requestHash: string | null;
}

export interface FulfillmentJobDependencies {
  readonly operations: Pick<ProviderOperationPort, 'record' | 'replayReference'>;
  readonly orders: OrderFulfillmentPort;
  readonly organizations: OrganizationReadPort;
  readonly vouchers: FulfillmentVoucherPort;
}
