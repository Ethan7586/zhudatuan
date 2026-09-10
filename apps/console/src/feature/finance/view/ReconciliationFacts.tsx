import { chineseDomainLabel, chineseReference } from '@shop/presentation';
import { formatMinor } from '../../../shared/ui/Format';
import type { FinanceReconciliation, FinanceReconciliationItem } from '../model/Finance';
import { reconciliationEvidence, reconciliationResolution, type ReconciliationEvidenceFact } from '../model/ReconciliationReview';
import type { ReconciliationViewModel } from '../viewmodel/ReconciliationViewModel';

export function ReconciliationFacts({ row, item, actions }: Readonly<{ row: FinanceReconciliation; item: FinanceReconciliationItem | undefined; actions: ReconciliationViewModel['actions'] }>) {
  const evidence = item ? reconciliationEvidence(row, item) : [];
  const businessEvidence = evidence.filter((fact) => !fact.technical);
  const technicalEvidence = evidence.filter((fact) => fact.technical);
  const resolution = item ? reconciliationResolution(item) : [];
  return (
    <>
      <div className="financereviewsection">
        <h3>
          <span>1</span>批次与匹配事实
        </h3>
        <dl className="financedetailgrid">
          <Detail label="对账状态" value={chineseDomainLabel(row.state)} />
          <Detail label="账期" value={row.period} />
          <Detail label="渠道金额" value={formatMinor(row.debitMinor)} />
          <Detail label="账本金额" value={formatMinor(row.creditMinor)} />
          <Detail label="差异金额" value={formatMinor(row.differenceMinor)} />
          <Detail label="已匹配" value={`${row.itemCounts.matched ?? 0} 笔`} />
          <Detail label="差异明细" value={`${row.itemCounts.difference ?? row.items.length} 笔`} />
          <Detail label="合作方" value={chineseReference('合作方', row.partnerId)} />
          <Detail label="渠道账单" value={chineseReference('渠道账单', row.statementRef)} />
        </dl>
      </div>

      <div className="financereviewsection">
        <h3>
          <span>2</span>差异明细与匹配证据
        </h3>
        {row.items.length === 0 ? (
          <p className="financereviewempty">本批次没有差异明细，批次事实仍可通过业务审计核验。</p>
        ) : (
          <div className="financedifferencepicker" role="listbox" aria-label="对账差异明细">
            {row.items.map((candidate, index) => (
              <button key={candidate.id} type="button" role="option" aria-selected={candidate.id === item?.id} data-active={candidate.id === item?.id} onClick={() => actions.item(candidate.id)}>
                <span>明细 {index + 1}</span>
                <strong>{formatMinor(candidate.differenceMinor)}</strong>
                <small>{chineseDomainLabel(candidate.state)}</small>
              </button>
            ))}
          </div>
        )}
        {item === undefined ? null : (
          <>
            <dl className="financedetailgrid financedifferencefacts">
              <Detail label="外部金额" value={formatMinor(item.externalMinor)} />
              <Detail label="内部金额" value={formatMinor(item.internalMinor)} />
              <Detail label="差异金额" value={formatMinor(item.differenceMinor)} />
              <Detail label="差异原因" value={item.reasonCode ? chineseDomainLabel(item.reasonCode, '其他差异原因') : '未标注'} />
              <Detail label="处理状态" value={chineseDomainLabel(item.state)} />
              <Detail label="处理人" value={item.resolvedBy ? chineseReference('成员', item.resolvedBy) : '尚未提交处理'} />
              <Detail label="复核人" value={item.approvedBy ? chineseReference('成员', item.approvedBy) : '尚未复核'} />
            </dl>
            <Evidence title="匹配证据" facts={businessEvidence} empty="服务端尚未返回可读匹配证据，请先核对渠道原始账单。" />
            {technicalEvidence.length === 0 ? null : (
              <details className="financetechnicalevidence">
                <summary>查看证据校验信息</summary>
                <Evidence title="技术校验信息" facts={technicalEvidence} />
              </details>
            )}
            {resolution.length === 0 ? null : <Evidence title="已提交处理依据" facts={resolution} />}
          </>
        )}
      </div>
    </>
  );
}

function Detail({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function Evidence({ title, facts, empty }: Readonly<{ title: string; facts: readonly ReconciliationEvidenceFact[]; empty?: string }>) {
  return (
    <section className="financeevidencegroup" aria-label={title}>
      <h4>{title}</h4>
      {facts.length === 0 ? (
        <p>{empty ?? '暂无记录'}</p>
      ) : (
        <dl className="financeevidence">
          {facts.map((fact) => (
            <Detail key={fact.key} label={fact.label} value={evidenceValue(fact.value)} />
          ))}
        </dl>
      )}
    </section>
  );
}

function evidenceValue(value: string): string {
  if (value === 'true') return '是';
  if (value === 'false') return '否';
  const date = new Date(value);
  if (/^\d{4}-\d{2}-\d{2}T/.test(value) && !Number.isNaN(date.getTime())) return date.toLocaleString('zh-CN', { hour12: false });
  return value.includes(':') && !value.includes('://') ? chineseReference('证据', value) : value;
}
