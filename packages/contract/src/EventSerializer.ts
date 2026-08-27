// Generated from definitions/events.yml. Do not edit.
import type { EventContract } from './EventContract';

export const SERIALIZED_EVENT_TYPES = Object.freeze([
  'identity.session.created',
  'identity.session.revoked',
  'identity.challenge.started',
  'identity.member.registered',
<<<<<<< HEAD
  'identity.member.reset',
  'access.version.changed',
  'access.owner.transfer.initiated',
  'access.owner.bootstrapped',
  'access.owner.transferred',
  'access.owner.transfer.cancelled',
=======
  'access.version.changed',
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
  'catalog.listing.published',
  'inventory.stock.changed',
  'inventory.stock.reserved',
  'experience.published',
  'checkout.quote.created',
  'checkout.quote.confirmed',
  'order.placed',
  'order.paid',
<<<<<<< HEAD
  'order.received',
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
  'order.cancelled',
  'payment.succeeded',
  'payment.refunded',
  'payment.late.detected',
  'payment.attempt.failed',
  'payment.provider.observed',
  'payment.autorefund.requested',
  'payment.recovery.opened',
  'fulfillment.shipped',
  'voucher.issued',
  'voucher.issue.failed',
  'voucher.import.failed',
  'voucher.status.failed',
  'voucher.redeemed',
  'benefit.granted',
  'benefit.expired',
  'benefit.expiry.reminded',
  'benefit.revoked',
  'benefit.grant.failed',
  'benefit.revoke.failed',
  'benefit.expiry.failed',
  'finance.entry.posted',
  'finance.reconciliation.difference',
  'finance.settlement.approved',
  'finance.settlement.adjusted',
  'finance.period.closed',
  'finance.withdrawal.paid',
  'finance.withdrawal.uncertain',
  'invoice.issued',
  'invoice.red.issued',
  'support.message.sent',
  'support.ticket.assigned',
  'support.sla.escalated',
  'channel.sync.completed',
  'channel.webhook.applied',
  'channel.refund.changed',
  'notification.delivered',
  'risk.policy.activated',
  'catalog.listing.unpublished',
  'risk.case.opened',
  'risk.case.resolved',
  'risk.transaction.blocked',
  'extension.enabled',
  'extension.disabled',
  'extension.degraded',
] as const);

export interface SerializedEvent {
  readonly type: string;
  readonly version: number;
  readonly module: string;
  readonly payload: unknown;
}

export function serializeEvent(contract: EventContract, payload: unknown): SerializedEvent {
  return Object.freeze({ type: contract.type, version: contract.version, module: contract.module, payload });
}
