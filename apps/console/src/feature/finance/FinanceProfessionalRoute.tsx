import { chineseDomainLabel, chineseReference, chineseSectionLabel, queryCondition, safeQueryError } from '@shop/presentation';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router';
import { useConsoleContext } from '../../entity/session/ConsoleContext';

import type { DataColumn } from '../../shared/ui/DataTable';
import { formatDate, formatMinor } from '../../shared/ui/Format';
import { PagedResource } from '../../shared/ui/PagedResource';
import { pageCursor } from '../../shared/url/PageCursor';
import { financeProfessionalKey, readFinanceProfessional } from './FinanceProfessionalQuery';
import type { FinanceRecord, FinanceSection } from './FinanceProfessionalSchema';
import { FinanceTabs, type FinanceWorkspaceTab } from './FinanceTabs';
import './FinanceWorkspace.css';

const columns: readonly DataColumn<FinanceRecord>[] = [
  { key: 'label', label: '记录', render: (row) => row.label },
  { key: 'reference', label: '业务编号', render: (row) => chineseReference('业务', row.reference) },
  { key: 'amount', label: '服务端金额', render: (row) => formatMinor(row.amountMinor, row.currency) },
  { key: 'state', label: '服务状态', render: (row) => chineseDomainLabel(row.state) },
  { key: 'time', label: '业务时间', render: (row) => formatDate(row.occurredAt) },
  { key: 'version', label: '版本', render: (row) => row.version ?? '—' },
];

const metadata: Readonly<Record<FinanceSection, Readonly<{ title: string; description: string }>>> = Object.freeze({
  entries: { title: '财务分录', description: '逐条展示服务端不可变借贷分录；前端不合计、不调账。' },
  statements: { title: '账单', description: '展示服务端期间账单及最终状态；导出需单独高风险旅程。' },
  reconciliations: { title: '对账', description: '展示服务端匹配结果、差异金额与处理状态。' },
  settlements: { title: '结算', description: '展示冻结结算和分账终态；前端不计算结算金额。' },
  withdrawals: { title: '提现', description: '展示提现申请和支付终态；不缓存或补交最终资金动作。' },
  invoices: { title: '发票', description: '展示开票申请、服务端金额、文档状态和版本。' },
});

export function FinanceProfessionalRoute({ section }: Readonly<{ section: FinanceSection }>) {
  const context = useConsoleContext();
  const [search, setSearch] = useSearchParams();
  const cursor = search.get('cursor') ?? undefined;
  const query = useQuery({ queryKey: financeProfessionalKey(context, section, cursor), queryFn: ({ signal }) => readFinanceProfessional(context, section, cursor, signal) });
  const data = query.data;
  const state = queryCondition({ pending: query.isPending, fetching: query.isFetching, error: query.error, hasData: data !== undefined, empty: data?.items.length === 0 });
  return (
    <section className="financeprofessionalworkspace">
      <FinanceTabs context={context} active={activeTab(section)} />
      <PagedResource
        title={metadata[section].title}
        eyebrow={chineseSectionLabel('财务管理')}
        description={metadata[section].description}
        condition={state}
        {...errorProps(safeQueryError(query.error))}
        rows={data?.items ?? []}
        columns={columns}
        rowKey={(row) => row.id}
        count={data?.count ?? 0}
        {...(data?.nextCursor === undefined ? {} : { nextCursor: data.nextCursor })}
        boundary={{ title: '资金写操作保持关闭', message: '操作预览、确认、二次验证、执行、权威回读、回执与操作绑定凭证未完整闭合前，本页只读。' }}
        retry={() => {
          void query.refetch();
        }}
        next={(next) => setSearch(pageCursor(search, next))}
      />
    </section>
  );
}

function activeTab(section: FinanceSection): FinanceWorkspaceTab | undefined {
  return section === 'entries' ? 'entries' : section === 'settlements' ? 'settlements' : undefined;
}

function errorProps(error: string | undefined): Readonly<{ error?: string }> {
  return error === undefined ? {} : { error };
}
