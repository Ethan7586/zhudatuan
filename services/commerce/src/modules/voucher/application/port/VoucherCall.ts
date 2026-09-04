import type { OperationId, OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { HandlerContext, WriteHandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationReply } from '../../../../foundation/application/OperationHandler';

export interface VoucherCall<TKey extends OperationId> {
  readonly input: OperationInputFor<TKey>;
  readonly context: HandlerContext<TKey> | WriteHandlerContext<TKey>;
  readonly scope: string;
  readonly tenant: string;
  readonly actor: string;
  readonly member: string;
  readonly target: string;
  readonly idempotency: string | null;
  readonly expectedVersion: number | null;
  readonly now: Date;
  readonly authorization: Readonly<Record<string, unknown>>;
}
export type VoucherReply<TKey extends OperationId> = Promise<OperationReply<OperationOutputFor<TKey>>>;
