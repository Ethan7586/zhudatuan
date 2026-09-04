import type { JsonObject } from '@shop/contract';
import type { ProviderOperationPort } from '../../../channel/public';
import type { FulfillmentOrderPort } from '../../../order/public';
import type { OrganizationReadPort } from '../../../organization/public';

export interface FulfillmentRow {
  readonly id: string;
  readonly order_id: string;
  readonly provider: string | null;
  readonly scope_id: string;
  readonly member_id: string;
  readonly state: string;
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
  readonly providerResponse: unknown;
  readonly requestHash: string | null;
}

export interface FulfillmentJobDependencies {
  readonly operations: Pick<ProviderOperationPort, 'record' | 'replayReference'>;
  readonly orders: FulfillmentOrderPort;
  readonly organizations: OrganizationReadPort;
}
