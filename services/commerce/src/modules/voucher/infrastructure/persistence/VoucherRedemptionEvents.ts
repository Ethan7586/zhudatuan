import { PgTransactionalOutbox } from '../../../../platform/database/PgTransactionalOutbox';
import { DomainError } from '../../../../platform/error/DomainError';
import type { WriteTransactionContext } from '../../../../platform/database/TransactionContext';
import type { OrganizationReadPort } from '../../../organization/public';
import { redemptionEventId, voucherRedeemed } from '../../domain/event/VoucherEvents';
import type { RedemptionContext } from '../../domain/value/RedemptionContext';

interface RedemptionEvent {
  readonly scope: string;
  readonly voucher: string;
  readonly redemption: string;
  readonly amountMinor: number;
  readonly currency: string;
  readonly version: number;
  readonly order: string | null;
  readonly store?: string;
  readonly actor: string;
  readonly now: Date;
}

/** Voucher owns the fact; Organization supplies the scoped reporting snapshot. */
export class VoucherRedemptionEvents {
  constructor(
    private readonly organizations: Pick<OrganizationReadPort, 'scope'>,
    private readonly outbox = new PgTransactionalOutbox()
  ) {}

  async snapshot(context: WriteTransactionContext, input: Pick<RedemptionEvent, 'scope' | 'order' | 'store'>): Promise<RedemptionContext> {
    if (input.order !== null && (input.store !== undefined || !input.order)) throw new DomainError('VOUCHER_REDEMPTION_CONFLICT');
    const owner = await this.organizations.scope(context, input.scope);
    if (owner.id !== input.scope) throw new DomainError('SCOPE_DENIED');
    const locationId = input.store ?? (input.order === null ? context.scope : null);
    if (input.store !== undefined && input.store !== context.scope) throw new DomainError('SCOPE_DENIED');
    const location = locationId === null ? null : locationId === owner.id ? owner : await this.organizations.scope(context, locationId);
    if (input.store !== undefined && location?.scopeKind !== 'store') throw new DomainError('SCOPE_DENIED');
    const store = location?.scopeKind === 'store' ? location : null;
    if (store && store.id !== owner.id && !store.ancestors.includes(owner.id)) throw new DomainError('SCOPE_DENIED');
    const scopes = [...new Set([owner.id, ...owner.ancestors, ...(store ? [store.id, ...store.ancestors] : [])])];
    return Object.freeze({ store: store?.id ?? null, channel: input.order ? 'order' : store ? 'store' : 'manual', scopes: Object.freeze(scopes), timezone: (store ?? owner).timezone });
  }

  async append(context: WriteTransactionContext, input: RedemptionEvent, snapshot: RedemptionContext): Promise<void> {
    await this.outbox.append(
      context,
      voucherRedeemed({
        ...snapshot,
        id: redemptionEventId(input.redemption),
        scope: input.scope,
        voucher: input.voucher,
        redemption: input.redemption,
        amountMinor: input.amountMinor,
        currency: input.currency,
        version: input.version,
        actor: input.actor,
        trace: context.trace,
        occurredAt: input.now.toISOString(),
        order: input.order,
      })
    );
  }
}
