import { randomUUID } from 'node:crypto';
import type { OperationRequest } from '../../../../pipeline/OperationHandler';
import { requireAccess } from '../../../../pipeline/OperationAccess';
import { domainEvent } from '@shop/kernel';
import type { OutboxWriter } from '../../../../platform/messaging/Outbox';
import type { WriteTransactionContext } from '../../../../platform/database/TransactionContext';
import type { CheckoutQuote } from '../../domain/model/CheckoutQuote';

export async function appendCheckoutEvents(
  outbox: OutboxWriter,
  context: WriteTransactionContext,
  request: OperationRequest,
  value: Readonly<{ checkout: string; quote: string; order: string; intent: string; snapshot: Readonly<Record<string, unknown>>; payload: CheckoutQuote }>
): Promise<void> {
  const access = requireAccess(request);
  const base = { tenant: value.payload.cart.mall, occurred: new Date().toISOString(), trace: access.trace } as const;
  await outbox.append(
    context,
    domainEvent({
      event: `event:${randomUUID()}`,
      type: 'checkout.quote.confirmed',
      version: 1,
      aggregate: { type: 'checkout', id: value.checkout, version: 2 },
      ...base,
      payload: { checkout: value.checkout, quote: value.quote, order: value.order, intent: value.intent },
    })
  );
  await outbox.append(
    context,
    domainEvent({
      event: `event:${randomUUID()}`,
      type: 'order.placed',
      version: 1,
      aggregate: { type: 'order', id: value.order, version: 1 },
      ...base,
      payload: value.snapshot,
    })
  );
}
