import { domainEvent, type DomainEvent } from '@shop/kernel';
import type { RedemptionContext } from '../value/RedemptionContext';

export function redemptionEventId(redemption: string): string {
  return `event:voucher:redemption:${redemption}`;
}
export function refundEventId(refund: string): string {
  return `event:voucher:refund:${refund}`;
}

export function voucherIssued(input: Readonly<{ id: string; scope: string; batch: string; count: number; amountMinor: number; actor: string; trace: string; version: number; occurredAt: string }>): DomainEvent {
  return domainEvent({
    event: input.id,
    type: 'voucher.issued',
    version: 1,
    aggregate: { type: 'issuebatch', id: input.batch, version: input.version },
    tenant: input.scope,
    actor: input.actor,
    correlation: input.trace,
    causation: input.trace,
    occurred: input.occurredAt,
    trace: input.trace,
    payloadVersion: 1,
    payload: { batch: input.batch, count: input.count, amountMinor: input.amountMinor },
  });
}

interface ValueEvent extends RedemptionContext {
  readonly id: string;
  readonly scope: string;
  readonly voucher: string;
  readonly redemption: string;
  readonly amountMinor: number;
  readonly currency: string;
  readonly order: string | null;
  readonly actor: string;
  readonly trace: string;
  readonly version: number;
  readonly occurredAt: string;
}

export function voucherRedeemed(input: ValueEvent): DomainEvent {
  return valueEvent('voucher.redeemed', 2, input);
}

export function voucherRefunded(input: ValueEvent & { readonly refund: string; readonly ruleVersion: number }): DomainEvent {
  return valueEvent('voucher.refunded', 1, input, { refund: input.refund, ruleVersion: input.ruleVersion });
}

function valueEvent(type: 'voucher.redeemed' | 'voucher.refunded', version: number, input: ValueEvent, extra: Readonly<Record<string, unknown>> = {}): DomainEvent {
  return domainEvent({
    event: input.id,
    type,
    version,
    aggregate: { type: 'voucher', id: input.voucher, version: input.version },
    tenant: input.scope,
    actor: input.actor,
    correlation: input.trace,
    causation: input.trace,
    occurred: input.occurredAt,
    trace: input.trace,
    payloadVersion: version,
    payload: {
      voucher: input.voucher,
      redemption: input.redemption,
      amountMinor: input.amountMinor,
      currency: input.currency,
      scope: input.scope,
      store: input.store,
      order: input.order,
      channel: input.channel,
      scopes: input.scopes,
      timezone: input.timezone,
      ...extra,
    },
  });
}
