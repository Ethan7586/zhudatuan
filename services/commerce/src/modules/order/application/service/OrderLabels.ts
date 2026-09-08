import type { ReadTransactionContext } from '../../../../platform/database/TransactionContext';
import type { MemberReadPort } from '../../../member/public';
import type { OrganizationReadPort } from '../../../organization/public';

type OrderListRow = Readonly<Record<string, unknown>>;

export class OrderLabels {
  constructor(
    private readonly members: Pick<MemberReadPort, 'profiles'>,
    private readonly organizations: Pick<OrganizationReadPort, 'summaries'>
  ) {}

  async list(context: ReadTransactionContext, scope: string, privateMembers: boolean, rows: readonly OrderListRow[]): Promise<readonly OrderListRow[]> {
    if (rows.length === 0) return Object.freeze([]);
    const memberIds = values(rows, 'member_id');
    const organizationIds = [...new Set([...values(rows, 'scope_id'), ...values(rows, 'mall_id')])];
    const [memberResult, organizationResult] = await Promise.allSettled([
      privateMembers ? Promise.resolve([]) : this.members.profiles(context, memberIds, scope),
      this.organizations.summaries(context, organizationIds),
    ]);
    const memberNames = new Map(
      memberResult.status === 'fulfilled' ? memberResult.value.map((profile) => [profile.member, profile.displayName] as const) : []
    );
    const organizationNames = new Map(
      organizationResult.status === 'fulfilled' ? organizationResult.value.map((organization) => [organization.id, organization.name] as const) : []
    );
    return Object.freeze(
      rows.map((row) =>
        Object.freeze({
          ...row,
          member_name: privateMembers ? '消费者（隐私保护）' : label(memberNames, row.member_id, '会员名称暂不可用'),
          scope_name: label(organizationNames, row.scope_id, '组织名称暂不可用'),
          mall_name: label(organizationNames, row.mall_id, '商城名称暂不可用'),
        })
      )
    );
  }
}

function values(rows: readonly OrderListRow[], key: string): string[] {
  return [...new Set(rows.flatMap((row) => (typeof row[key] === 'string' && row[key].length > 0 ? [row[key]] : [])))];
}

function label(names: ReadonlyMap<string, string>, id: unknown, fallback: string): string {
  return typeof id === 'string' ? (names.get(id) ?? fallback) : fallback;
}
