import type { ReadTransactionContext } from '../../../../platform/database/TransactionContext';
import type { MemberReadPort } from '../../../member/public';
import type { OrganizationReadPort } from '../../../organization/public';
import type { CatalogPartnerPort } from '../../../partner/public';

type OrderListRow = Readonly<Record<string, unknown>>;
export interface OrderLabelRequest {
  readonly members: readonly string[];
  readonly organizations: readonly string[];
  readonly partners: readonly string[];
  readonly principals: readonly string[];
  readonly privateMembers: boolean;
}

export class ResolvedOrderLabels {
  constructor(
    private readonly members: ReadonlyMap<string, string>,
    private readonly organizations: ReadonlyMap<string, string>,
    private readonly partners: ReadonlyMap<string, string>,
    private readonly principals: ReadonlyMap<string, string>,
    private readonly privateMembers: boolean
  ) {}

  member(id: unknown): string {
    if (this.privateMembers) return '消费者（隐私保护）';
    return label(this.members, id, '会员名称暂不可用');
  }

  organization(id: unknown, kind: 'scope' | 'mall'): string {
    return label(this.organizations, id, kind === 'mall' ? '商城名称暂不可用' : '组织名称暂不可用');
  }

  partner(id: unknown): string | null {
    if (id === null || id === undefined || id === '') return null;
    return label(this.partners, id, '合作方名称暂不可用');
  }

  actor(id: string | null, kind: string): string {
    if (id !== null) {
      const name = this.principals.get(id);
      if (name !== undefined) return name;
    }
    if (['system', 'service', 'job', 'scheduler'].includes(kind)) return '系统自动处理';
    if (kind === 'provider') return '外部服务自动处理';
    return '操作人资料受保护';
  }
}

export class OrderLabels {
  constructor(
    private readonly members: Pick<MemberReadPort, 'profiles' | 'principals'>,
    private readonly organizations: Pick<OrganizationReadPort, 'summaries'>,
    private readonly partners: Pick<CatalogPartnerPort, 'names'>
  ) {}

  async list(context: ReadTransactionContext, scope: string, privateMembers: boolean, rows: readonly OrderListRow[]): Promise<readonly OrderListRow[]> {
    if (rows.length === 0) return Object.freeze([]);
    const resolved = await this.resolve(context, scope, {
      members: values(rows, 'member_id'),
      organizations: [...values(rows, 'scope_id'), ...values(rows, 'mall_id')],
      partners: nestedValues(rows, ['lines', 'fulfillments'], 'partner'),
      principals: [],
      privateMembers,
    });
    return Object.freeze(
      rows.map((row) =>
        Object.freeze({
          ...row,
          member_name: resolved.member(row.member_id),
          scope_name: resolved.organization(row.scope_id, 'scope'),
          mall_name: resolved.organization(row.mall_id, 'mall'),
          lines: nestedLabels(row.lines, resolved),
          fulfillments: nestedLabels(row.fulfillments, resolved),
        })
      )
    );
  }

  async resolve(context: ReadTransactionContext, scope: string, request: OrderLabelRequest): Promise<ResolvedOrderLabels> {
    const memberIds = unique(request.members);
    const organizationIds = unique(request.organizations);
    const partnerIds = unique(request.partners);
    const principalIds = unique(request.principals);
    const [memberResult, organizationResult, partnerResult, principalResult] = await Promise.allSettled([
      request.privateMembers || memberIds.length === 0 ? Promise.resolve([]) : this.members.profiles(context, memberIds, scope),
      organizationIds.length === 0 ? Promise.resolve([]) : this.organizations.summaries(context, organizationIds),
      partnerIds.length === 0 ? Promise.resolve(new Map<string, string>()) : this.partners.names(context, partnerIds),
      principalIds.length === 0 ? Promise.resolve([]) : this.members.principals(context, principalIds, scope),
    ]);
    return new ResolvedOrderLabels(
      new Map(memberResult.status === 'fulfilled' ? memberResult.value.map((profile) => [profile.member, profile.displayName] as const) : []),
      new Map(organizationResult.status === 'fulfilled' ? organizationResult.value.map((organization) => [organization.id, organization.name] as const) : []),
      partnerResult.status === 'fulfilled' ? partnerResult.value : new Map(),
      new Map(principalResult.status === 'fulfilled' ? principalResult.value.map((profile) => [profile.principal, profile.displayName] as const) : []),
      request.privateMembers
    );
  }
}

function values(rows: readonly OrderListRow[], key: string): string[] {
  return unique(rows.flatMap((row) => (typeof row[key] === 'string' && row[key].length > 0 ? [row[key]] : [])));
}

function nestedValues(rows: readonly OrderListRow[], collections: readonly string[], key: string): string[] {
  return unique(
    rows.flatMap((row) => collections.flatMap((collection) => (Array.isArray(row[collection]) ? row[collection].flatMap((item) => (record(item) && typeof item[key] === 'string' && item[key].length > 0 ? [item[key]] : [])) : [])))
  );
}

function nestedLabels(value: unknown, labels: ResolvedOrderLabels): unknown {
  if (!Array.isArray(value)) return value;
  return Object.freeze(value.map((item) => (record(item) ? Object.freeze({ ...item, partnerName: labels.partner(item.partner) }) : item)));
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}

function record(value: unknown): value is Readonly<Record<string, unknown>> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function label(names: ReadonlyMap<string, string>, id: unknown, fallback: string): string {
  return typeof id === 'string' ? (names.get(id) ?? fallback) : fallback;
}
