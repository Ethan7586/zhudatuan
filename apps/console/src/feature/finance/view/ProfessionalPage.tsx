import { chineseDomainLabel, chineseReference, chineseSectionLabel } from '@shop/presentation';
import type { DataColumn } from '@shop/design';
import { formatDate, formatMinor } from '../../../shared/ui/Format';
import { PagedResource } from '../../../shared/ui/PagedResource';
import type { FinanceRecord, FinanceSection } from '../model/Finance';
import type { SectionViewModel } from '../viewmodel/SectionViewModel';
import { FinanceTabs } from './FinanceTabs';
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

export function ProfessionalPage({ title, model }: Readonly<{ title: string; model: SectionViewModel }>) {
  const data = model.data;
  return (
    <section className="financeprofessionalworkspace">
      <FinanceTabs model={model.navigation} />
      <PagedResource
        title={title}
        eyebrow={chineseSectionLabel('财务管理')}
        description={metadata[model.section].description}
        condition={model.condition}
        {...errorProps(model.error)}
        rows={data?.items ?? []}
        columns={columns}
        rowKey={(row) => row.id}
        count={data?.count ?? 0}
        {...(data?.nextCursor === undefined ? {} : { nextCursor: data.nextCursor })}
        retry={model.refresh}
        next={model.next}
      />
    </section>
  );
}

function errorProps(error: string | undefined): Readonly<{ error?: string }> {
  return error === undefined ? {} : { error };
}
