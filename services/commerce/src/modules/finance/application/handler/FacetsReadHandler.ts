import { PROVIDER_REQUIREMENTS, type OperationInputFor, type OperationOutputFor } from '@shop/contract';
import type { HandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler } from '../../../../foundation/application/OperationHandler';
import { requireSession } from '../../../../foundation/security/OperationSecurityContext';
import type { FinanceChannelPort } from '../../../channel/public';
import type { OrganizationReadPort } from '../../../organization/public';
import type { FacetRepository, FinanceFacetCount } from '../port/FacetRepository';

const providerLabels = Object.freeze(Object.fromEntries(PROVIDER_REQUIREMENTS.map(({ id, label }) => [id, label])) as Readonly<Record<string, string>>);
const stateLabels: Readonly<Record<string, string>> = Object.freeze({ received: '已接收', matching: '匹配中', balanced: '已平衡', difference: '有差异', approved: '已复核' });
const differenceLabels: Readonly<Record<string, string>> = Object.freeze({
  JOURNAL_MISSING: '系统流水缺失',
  STATEMENT_MISSING: '渠道流水缺失',
  AMOUNT_MISMATCH: '金额不一致',
  CURRENCY_MISMATCH: '币种不一致',
  DATE_MISMATCH: '日期不一致',
  DUPLICATE_REFERENCE: '业务引用重复',
});

export class FacetsReadHandler implements OperationHandler<'finance.facets.read', 'read'> {
  readonly operation = 'finance.facets.read' as const;
  readonly mode = 'read' as const;

  constructor(
    private readonly facets: FacetRepository,
    private readonly organizations: Pick<OrganizationReadPort, 'descendants' | 'activeMalls' | 'summaries'>,
    private readonly channels: Pick<FinanceChannelPort, 'importProviders'>
  ) {}

  async execute(_input: OperationInputFor<'finance.facets.read'>, context: HandlerContext<'finance.facets.read'>) {
    const access = requireSession(context.security);
    const scopes = await this.organizations.descendants(context.transaction, access.scope.id);
    const [snapshot, mallIds, importProviders] = await Promise.all([
      this.facets.read(context.transaction, scopes),
      this.organizations.activeMalls(context.transaction, access.scope.id),
      this.channels.importProviders(context.transaction, scopes),
    ]);
    const mallSummaries = await this.organizations.summaries(context.transaction, mallIds);
    const mallCounts = new Map(snapshot.malls.map(({ value, count }) => [value, count]));
    const activeProviders = new Map(importProviders.map((provider) => [provider.id, provider]));
    const providerCounts = new Map(snapshot.providers.map(({ value, count }) => [value, count]));
    const providerIds = [...new Set([...providerCounts.keys(), ...activeProviders.keys()])].sort((left, right) => (providerCounts.get(right) ?? 0) - (providerCounts.get(left) ?? 0) || left.localeCompare(right));
    const body = {
      periods: group(snapshot.periods.map(({ value, count }) => ({ value, count, label: periodLabel(value) })), '当前范围还没有可筛选的账期。'),
      providers: {
        items: providerIds.map((value) => ({
          value,
          label: activeProviders.get(value)?.label ?? providerLabels[value] ?? '自定义服务商',
          count: providerCounts.get(value) ?? 0,
          available: activeProviders.has(value),
        })),
        reason: activeProviders.size === 0 ? '当前范围没有已启用的渠道连接，请先到渠道工作台完成连接配置和连通性测试。' : null,
      },
      malls: group(mallSummaries.map(({ id, name }) => ({ value: id, label: name, count: mallCounts.get(id) ?? 0 })), '当前范围没有可用商城。'),
      states: group(snapshot.states.map(({ value, count }) => ({ value, count, label: stateLabels[value] ?? '其他状态' })), '当前范围还没有对账状态。'),
      differenceTypes: group(snapshot.differenceTypes.map(({ value, count }) => ({ value, count, label: differenceLabels[value] ?? '其他差异' })), '当前范围还没有对账差异类型。'),
      watermark: snapshot.watermark,
    } satisfies OperationOutputFor<'finance.facets.read'>;
    return { status: 200, body } as const;
  }
}

function group(items: readonly Readonly<{ value: string; label: string; count: number }>[], reason: string) {
  return { items: [...items], reason: items.length === 0 ? reason : null };
}

function periodLabel(value: string): string {
  const [start, end] = value.split('/');
  return start && end ? `${start} 至 ${end}` : value;
}
