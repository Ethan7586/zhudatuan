import type { SqlExecutor } from '../../../../platform/database/PgTransactionAccess';
import { PgTransactionAccess } from '../../../../platform/database/PgTransactionAccess';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../platform/database/TransactionContext';
import type { MemberAccessPort } from '../../../access/public';
import type { SupportBenefitPort } from '../../../benefit/public';
import type { MemberReadPort } from '../../../member/public';
import type { OrderSupportPort } from '../../../order/public';
import type { OrganizationReadPort } from '../../../organization/public';
import type { SupportContextPort, SupportContextView } from '../../application/port/SupportPersistence';

export class PgSupportContextRepository implements SupportContextPort {
  constructor(
    private readonly orders: OrderSupportPort,
    private readonly organizations: OrganizationReadPort,
    private readonly members: MemberAccessPort,
    private readonly benefits: SupportBenefitPort,
    private readonly profiles: MemberReadPort,
    private readonly transactions = new PgTransactionAccess()
  ) {}

  member(context: ReadTransactionContext, membership: string): Promise<string> {
    return this.members.member(context, membership);
  }

  descendants(context: ReadTransactionContext, scope: string): Promise<readonly string[]> {
    return this.organizations.descendants(context, scope);
  }

  async benefit(context: ReadTransactionContext, type: string, id: string, scope: string, member: string): Promise<Readonly<Record<string, unknown>>> {
    if (type !== 'benefitlot') throw new Error('SUPPORT_REFERENCE_TYPE_INVALID');
    const result = await this.benefits.lot(context, id, member, await this.descendants(context, scope));
    if (!result) throw new Error('SUPPORT_BENEFIT_REFERENCE_INVALID');
    return result;
  }

  async view(context: ReadTransactionContext, scope: string, member: string, memberOnly: boolean): Promise<SupportContextView> {
    const scopes = await this.descendants(context, scope);
    const profile = await this.profiles.summary(context, member, scope);
    if (!profile) throw new Error('SUPPORT_MEMBER_NOT_FOUND');
    const orders = await this.orders.recent(context, scopes, member, memberOnly, 5);
    const benefits = await this.benefits.recent(context, member, scopes, 5);
    return Object.freeze({
      member: Object.freeze({ id: profile.id, displayName: profile.displayName, employeeNo: profile.employeeNo, mobileMasked: profile.mobileMasked }),
      organization: Object.freeze({ id: scope }),
      orders: Object.freeze(orders.map((order) => Object.freeze({ id: order.id, number: order.number, state: order.state, totalMinor: order.totalMinor }))),
      benefits: Object.freeze(benefits.map(benefitView)),
    });
  }

  async collaborate(context: WriteTransactionContext, input: Readonly<{ order: string; supportCase: string; scopes: readonly string[]; member: string; memberOnly: boolean; actor: string; trace: string }>): Promise<void> {
    await this.orders.collaborate(context, { id: `supportcollaboration:${input.supportCase}`, ...input });
  }

  database(context: ReadTransactionContext): SqlExecutor {
    return this.transactions.database(context);
  }
}

function benefitView(value: Readonly<Record<string, unknown>>): SupportContextView['benefits'][number] {
  return Object.freeze({
    id: requiredText(value.id, 'SUPPORT_BENEFIT_ID_INVALID'),
    state: requiredText(value.state, 'SUPPORT_BENEFIT_STATE_INVALID'),
    kind: requiredText(value.kind, 'SUPPORT_BENEFIT_KIND_INVALID'),
    currency: requiredText(value.currency, 'SUPPORT_BENEFIT_CURRENCY_INVALID'),
    remainingMinor: Number(value.remaining_minor),
    expiresAt: value.expires_at === null || value.expires_at === undefined ? null : new Date(requiredText(value.expires_at, 'SUPPORT_BENEFIT_EXPIRY_INVALID')).toISOString(),
  });
}

function requiredText(value: unknown, code: string): string {
  if (typeof value !== 'string' || value.length === 0) throw new Error(code);
  return value;
}
